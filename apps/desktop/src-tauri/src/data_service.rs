use std::{
    convert::Infallible,
    net::{Ipv4Addr, SocketAddr},
    path::{Path, PathBuf},
    time::Duration,
};

use axum::{
    body::Body,
    extract::{DefaultBodyLimit, State},
    http::{header, HeaderValue, Method, StatusCode, Uri},
    response::{sse::Event, IntoResponse, Response, Sse},
    routing::{get, post},
    Json, Router,
};
use include_dir::{include_dir, Dir};
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use tokio::sync::broadcast;
use tokio_stream::{wrappers::BroadcastStream, StreamExt};
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    limit::RequestBodyLimitLayer,
    trace::TraceLayer,
};

pub const DATA_SERVICE_PORT: u16 = 24_873;
pub const DATA_SERVICE_URL: &str = "http://127.0.0.1:24873";
const MAX_REQUEST_BYTES: usize = 128 * 1024 * 1024;
const SNAPSHOT_HISTORY_LIMIT: i64 = 20;
static WEB_DIST: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../../web/dist");

#[derive(Clone)]
struct ServiceState {
    database_path: PathBuf,
    revisions: broadcast::Sender<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    service: &'static str,
    version: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceResponse {
    payload: Value,
    revision: i64,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveWorkspaceRequest {
    base_revision: Option<i64>,
    payload: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveWorkspaceResponse {
    revision: i64,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MigrationBackupRequest {
    payload: Value,
    source_id: String,
    source_label: String,
}

#[derive(Debug, Serialize)]
struct MigrationBackupResponse {
    stored: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConflictResponse {
    current_revision: i64,
    message: &'static str,
}

pub fn start(database_path: PathBuf) -> Result<(), String> {
    initialize_database(&database_path).map_err(|error| error.to_string())?;
    let listener = bind_listener()?;
    std::thread::Builder::new()
        .name("easydo-data-service".to_string())
        .spawn(move || {
            run_with_listener(database_path, listener).expect("EasyDo 本地数据服务异常退出");
        })
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn run_blocking(database_path: PathBuf) -> Result<(), String> {
    initialize_database(&database_path).map_err(|error| error.to_string())?;
    run_with_listener(database_path, bind_listener()?)
}

fn bind_listener() -> Result<std::net::TcpListener, String> {
    let address = SocketAddr::from((Ipv4Addr::LOCALHOST, DATA_SERVICE_PORT));
    let listener = std::net::TcpListener::bind(address)
        .map_err(|error| format!("EasyDo 本地数据端口不可用: {error}"))?;
    listener
        .set_nonblocking(true)
        .map_err(|error| error.to_string())?;
    Ok(listener)
}

fn run_with_listener(
    database_path: PathBuf,
    listener: std::net::TcpListener,
) -> Result<(), String> {
    let (revisions, _) = broadcast::channel(32);
    let state = ServiceState {
        database_path,
        revisions,
    };
    let runtime = tokio::runtime::Runtime::new().map_err(|error| error.to_string())?;
    runtime.block_on(async move {
        let listener =
            tokio::net::TcpListener::from_std(listener).map_err(|error| error.to_string())?;
        axum::serve(listener, router(state))
            .await
            .map_err(|error| error.to_string())
    })
}

fn router(state: ServiceState) -> Router {
    let allowed_origins = [
        "http://127.0.0.1:1420",
        "http://localhost:1420",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:24873",
        "http://localhost:24873",
        "tauri://localhost",
        "http://tauri.localhost",
        "https://tauri.localhost",
    ]
    .map(HeaderValue::from_static);
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(allowed_origins))
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::OPTIONS])
        .allow_headers([
            header::CONTENT_TYPE,
            header::HeaderName::from_static("x-easydo-client"),
        ]);

    Router::new()
        .route("/api/v1/health", get(health))
        .route("/api/v1/workspace", get(load_workspace).put(save_workspace))
        .route("/api/v1/migrations", post(store_migration_backup))
        .route("/api/v1/events", get(events))
        .fallback(get(static_asset))
        .layer(DefaultBodyLimit::disable())
        .layer(RequestBodyLimitLayer::new(MAX_REQUEST_BYTES))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        service: "EasyDo local data service",
        version: env!("CARGO_PKG_VERSION"),
    })
}

async fn load_workspace(State(state): State<ServiceState>) -> Response {
    match tokio::task::spawn_blocking(move || read_workspace(&state.database_path)).await {
        Ok(Ok(Some(workspace))) => Json(workspace).into_response(),
        Ok(Ok(None)) => StatusCode::NO_CONTENT.into_response(),
        Ok(Err(error)) => internal_error(error),
        Err(error) => internal_error(error),
    }
}

async fn save_workspace(
    State(state): State<ServiceState>,
    Json(request): Json<SaveWorkspaceRequest>,
) -> Response {
    if !is_valid_workspace(&request.payload) {
        return (StatusCode::UNPROCESSABLE_ENTITY, "数据格式不正确.").into_response();
    }

    let database_path = state.database_path.clone();
    match tokio::task::spawn_blocking(move || {
        write_workspace(&database_path, request.base_revision, &request.payload)
    })
    .await
    {
        Ok(Ok(saved)) => {
            let _ = state.revisions.send(saved.revision);
            Json(saved).into_response()
        }
        Ok(Err(WriteError::Conflict(current_revision))) => (
            StatusCode::CONFLICT,
            Json(ConflictResponse {
                current_revision,
                message: "数据已在其他窗口更新, 请重新应用本次操作.",
            }),
        )
            .into_response(),
        Ok(Err(WriteError::Database(error))) => internal_error(error),
        Err(error) => internal_error(error),
    }
}

async fn store_migration_backup(
    State(state): State<ServiceState>,
    Json(request): Json<MigrationBackupRequest>,
) -> Response {
    if request.source_id.trim().is_empty()
        || request.source_label.trim().is_empty()
        || !is_valid_workspace(&request.payload)
    {
        return (StatusCode::UNPROCESSABLE_ENTITY, "迁移备份格式不正确.").into_response();
    }
    let database_path = state.database_path.clone();
    match tokio::task::spawn_blocking(move || write_migration_backup(&database_path, &request))
        .await
    {
        Ok(Ok(stored)) => Json(MigrationBackupResponse { stored }).into_response(),
        Ok(Err(error)) => internal_error(error),
        Err(error) => internal_error(error),
    }
}

async fn events(
    State(state): State<ServiceState>,
) -> Sse<impl tokio_stream::Stream<Item = Result<Event, Infallible>>> {
    let stream =
        BroadcastStream::new(state.revisions.subscribe()).filter_map(|result| match result {
            Ok(revision) => Some(Ok(Event::default()
                .event("workspace")
                .data(revision.to_string()))),
            Err(_) => None,
        });
    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("保持连接"),
    )
}

async fn static_asset(uri: Uri) -> Response {
    let requested = uri.path().trim_start_matches('/');
    let path = if requested.is_empty() {
        "index.html"
    } else {
        requested
    };
    let file = WEB_DIST
        .get_file(path)
        .or_else(|| WEB_DIST.get_file("index.html"));

    match file {
        Some(file) => {
            let mime = mime_guess::from_path(file.path()).first_or_octet_stream();
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, mime.as_ref())
                .header(
                    header::CACHE_CONTROL,
                    if path == "index.html" {
                        "no-cache"
                    } else {
                        "public, max-age=31536000, immutable"
                    },
                )
                .body(Body::from(file.contents()))
                .expect("无法创建静态资源响应")
        }
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

fn open_connection(path: &Path) -> rusqlite::Result<Connection> {
    let connection = Connection::open(path)?;
    connection.busy_timeout(Duration::from_secs(5))?;
    connection.pragma_update(None, "journal_mode", "WAL")?;
    connection.pragma_update(None, "foreign_keys", "ON")?;
    Ok(connection)
}

fn initialize_database(path: &Path) -> rusqlite::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))?;
    }
    let connection = open_connection(path)?;
    connection.execute_batch(
        "CREATE TABLE IF NOT EXISTS snapshots (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS snapshot_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_snapshot_history_created_at
            ON snapshot_history(created_at DESC);
        CREATE TABLE IF NOT EXISTS migration_backups (
            source_id TEXT PRIMARY KEY,
            source_label TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL
        );",
    )?;
    if !column_exists(&connection, "snapshots", "revision")? {
        connection.execute(
            "ALTER TABLE snapshots ADD COLUMN revision INTEGER NOT NULL DEFAULT 1",
            [],
        )?;
    }
    if !column_exists(&connection, "snapshot_history", "revision")? {
        connection.execute(
            "ALTER TABLE snapshot_history ADD COLUMN revision INTEGER NOT NULL DEFAULT 0",
            [],
        )?;
    }
    Ok(())
}

fn column_exists(connection: &Connection, table: &str, column: &str) -> rusqlite::Result<bool> {
    let mut statement = connection.prepare(&format!("PRAGMA table_info({table})"))?;
    let columns = statement.query_map([], |row| row.get::<_, String>(1))?;
    for item in columns {
        if item? == column {
            return Ok(true);
        }
    }
    Ok(false)
}

fn read_workspace(path: &Path) -> rusqlite::Result<Option<WorkspaceResponse>> {
    let connection = open_connection(path)?;
    let current = connection
        .query_row(
            "SELECT payload, revision, updated_at FROM snapshots WHERE id = 'current' LIMIT 1",
            [],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                ))
            },
        )
        .optional()?;
    let Some((payload, revision, updated_at)) = current else {
        return Ok(None);
    };
    if let Ok(value) = serde_json::from_str::<Value>(&payload) {
        if is_valid_workspace(&value) {
            return Ok(Some(WorkspaceResponse {
                payload: value,
                revision,
                updated_at,
            }));
        }
    }

    let recovered = {
        let mut statement =
            connection.prepare("SELECT payload FROM snapshot_history ORDER BY id DESC LIMIT ?1")?;
        let candidates =
            statement.query_map([SNAPSHOT_HISTORY_LIMIT], |row| row.get::<_, String>(0))?;
        let mut recovered = None;
        for candidate in candidates {
            let candidate = candidate?;
            if let Ok(value) = serde_json::from_str::<Value>(&candidate) {
                if is_valid_workspace(&value) {
                    recovered = Some((candidate, value));
                    break;
                }
            }
        }
        recovered
    };
    let Some((serialized, value)) = recovered else {
        return Err(rusqlite::Error::InvalidQuery);
    };
    let recovered_revision = revision + 1;
    let recovered_at = chrono_timestamp();
    connection.execute(
        "UPDATE snapshots SET payload = ?1, updated_at = ?2, revision = ?3 WHERE id = 'current'",
        params![serialized, recovered_at, recovered_revision],
    )?;
    Ok(Some(WorkspaceResponse {
        payload: value,
        revision: recovered_revision,
        updated_at: recovered_at,
    }))
}

#[derive(Debug)]
enum WriteError {
    Conflict(i64),
    Database(rusqlite::Error),
}

impl From<rusqlite::Error> for WriteError {
    fn from(value: rusqlite::Error) -> Self {
        Self::Database(value)
    }
}

fn write_workspace(
    path: &Path,
    base_revision: Option<i64>,
    payload: &Value,
) -> Result<SaveWorkspaceResponse, WriteError> {
    let mut connection = open_connection(path)?;
    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let current: Option<(String, i64)> = transaction
        .query_row(
            "SELECT payload, revision FROM snapshots WHERE id = 'current' LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    let current_revision = current.as_ref().map_or(0, |(_, revision)| *revision);
    if base_revision.unwrap_or(0) != current_revision {
        return Err(WriteError::Conflict(current_revision));
    }

    let serialized = serde_json::to_string(payload).map_err(|error| {
        WriteError::Database(rusqlite::Error::ToSqlConversionFailure(Box::new(error)))
    })?;
    let updated_at = chrono_timestamp();
    let revision = current_revision + 1;
    if let Some((current_payload, _)) = current {
        if current_payload == serialized {
            transaction.commit()?;
            return Ok(SaveWorkspaceResponse {
                revision: current_revision,
                updated_at,
            });
        }
        transaction.execute(
            "INSERT INTO snapshot_history(payload, created_at, revision) VALUES (?1, ?2, ?3)",
            params![current_payload, updated_at, current_revision],
        )?;
    }
    transaction.execute(
        "INSERT INTO snapshots(id, payload, updated_at, revision)
         VALUES ('current', ?1, ?2, ?3)
         ON CONFLICT(id) DO UPDATE SET
           payload = excluded.payload,
           updated_at = excluded.updated_at,
           revision = excluded.revision",
        params![serialized, updated_at, revision],
    )?;
    transaction.execute(
        "DELETE FROM snapshot_history WHERE id NOT IN (
            SELECT id FROM snapshot_history ORDER BY id DESC LIMIT ?1
        )",
        [SNAPSHOT_HISTORY_LIMIT],
    )?;
    transaction.commit()?;
    Ok(SaveWorkspaceResponse {
        revision,
        updated_at,
    })
}

fn write_migration_backup(path: &Path, request: &MigrationBackupRequest) -> rusqlite::Result<bool> {
    let connection = open_connection(path)?;
    let serialized = serde_json::to_string(&request.payload)
        .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))?;
    let changed = connection.execute(
        "INSERT OR IGNORE INTO migration_backups(source_id, source_label, payload, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![
            request.source_id,
            request.source_label,
            serialized,
            chrono_timestamp()
        ],
    )?;
    Ok(changed > 0)
}

fn is_valid_workspace(payload: &Value) -> bool {
    let Some(object) = payload.as_object() else {
        return false;
    };
    let version_valid = object
        .get("version")
        .and_then(Value::as_u64)
        .is_some_and(|version| version == 4 || version == 5);
    version_valid
        && [
            "activities",
            "categories",
            "countdowns",
            "filters",
            "focusSessions",
            "folders",
            "habits",
            "sections",
            "tags",
            "tasks",
            "templates",
        ]
        .iter()
        .all(|key| object.get(*key).is_some_and(Value::is_array))
        && object.get("settings").is_some_and(Value::is_object)
}

fn chrono_timestamp() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .expect("系统时间无法格式化")
}

fn internal_error(error: impl std::fmt::Display) -> Response {
    log::error!("本地数据服务错误: {error}");
    (StatusCode::INTERNAL_SERVER_ERROR, "本地数据服务暂时不可用.").into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::tempdir;

    fn payload(title: &str) -> Value {
        json!({
            "activities": [], "categories": [], "countdowns": [], "exportedAt": "2026-09-01T00:00:00.000Z",
            "filters": [], "focusSessions": [], "folders": [], "habits": [], "sections": [],
            "settings": {"id": "default"}, "tags": [], "tasks": [{"id": "task-1", "title": title}],
            "templates": [], "version": 5
        })
    }

    #[test]
    fn workspace_write_requires_current_revision() {
        let directory = tempdir().unwrap();
        let path = directory.path().join("easydo.db");
        initialize_database(&path).unwrap();
        let first = write_workspace(&path, None, &payload("第一版")).unwrap();
        assert_eq!(first.revision, 1);
        let conflict = write_workspace(&path, None, &payload("冲突"));
        assert!(matches!(conflict, Err(WriteError::Conflict(1))));
        let second = write_workspace(&path, Some(1), &payload("第二版")).unwrap();
        assert_eq!(second.revision, 2);
        assert_eq!(
            read_workspace(&path).unwrap().unwrap().payload,
            payload("第二版")
        );
    }

    #[test]
    fn migration_backup_is_immutable_per_source() {
        let directory = tempdir().unwrap();
        let path = directory.path().join("easydo.db");
        initialize_database(&path).unwrap();
        let request = MigrationBackupRequest {
            payload: payload("旧数据"),
            source_id: "browser-a".to_string(),
            source_label: "网页端".to_string(),
        };
        assert!(write_migration_backup(&path, &request).unwrap());
        assert!(!write_migration_backup(&path, &request).unwrap());
    }

    #[test]
    fn legacy_snapshot_schema_is_upgraded_without_data_loss() {
        let directory = tempdir().unwrap();
        let path = directory.path().join("easydo.db");
        let connection = Connection::open(&path).unwrap();
        connection.execute_batch(
            "CREATE TABLE snapshots (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
             INSERT INTO snapshots VALUES ('current', '{\"version\":5}', 'old');",
        ).unwrap();
        drop(connection);
        initialize_database(&path).unwrap();
        let connection = open_connection(&path).unwrap();
        assert!(column_exists(&connection, "snapshots", "revision").unwrap());
        let payload: String = connection
            .query_row(
                "SELECT payload FROM snapshots WHERE id = 'current'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(payload, "{\"version\":5}");
    }

    #[test]
    fn corrupted_current_snapshot_recovers_from_latest_valid_history() {
        let directory = tempdir().unwrap();
        let path = directory.path().join("easydo.db");
        initialize_database(&path).unwrap();
        let connection = open_connection(&path).unwrap();
        connection
            .execute(
                "INSERT INTO snapshots(id, payload, updated_at, revision) VALUES ('current', 'broken', 'old', 4)",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO snapshot_history(payload, created_at, revision) VALUES (?1, 'old', 3)",
                [serde_json::to_string(&payload("可恢复数据")).unwrap()],
            )
            .unwrap();
        drop(connection);

        let recovered = read_workspace(&path).unwrap().unwrap();

        assert_eq!(recovered.payload, payload("可恢复数据"));
        assert_eq!(recovered.revision, 5);
    }
}
