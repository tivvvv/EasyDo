use tauri::{Emitter, Manager};
use tauri_plugin_sql::{Migration, MigrationKind};

const SNAPSHOT_MIGRATION_SQL: &str = "CREATE TABLE IF NOT EXISTS snapshots (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS snapshot_history (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, created_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS idx_snapshot_history_created_at ON snapshot_history(created_at DESC);";

fn badge_count(count: u32) -> Option<i64> {
    if count == 0 {
        None
    } else {
        Some(count.into())
    }
}

#[tauri::command]
fn set_dock_badge(app: tauri::AppHandle, count: u32) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "无法找到主窗口.".to_string())?;
    window
        .set_badge_count(badge_count(count))
        .map_err(|error| error.to_string())
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "创建本地快照和恢复历史",
        sql: SNAPSHOT_MIGRATION_SQL,
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:easydo.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name("EasyDo")
                .build(),
        )
        .invoke_handler(tauri::generate_handler![set_dock_badge])
        .setup(|app| {
            let menu = tauri::menu::Menu::default(app.handle())?;
            app.set_menu(menu)?;
            #[cfg(desktop)]
            {
                let show =
                    tauri::menu::MenuItem::with_id(app, "show", "显示 EasyDo", true, None::<&str>)?;
                let quick_add = tauri::menu::MenuItem::with_id(
                    app,
                    "quick-add",
                    "快速添加任务",
                    true,
                    Some("CmdOrCtrl+Shift+N"),
                )?;
                let quit =
                    tauri::menu::MenuItem::with_id(app, "quit", "退出 EasyDo", true, None::<&str>)?;
                let tray_menu = tauri::menu::Menu::with_items(app, &[&show, &quick_add, &quit])?;
                tauri::tray::TrayIconBuilder::new()
                    .icon(
                        app.default_window_icon()
                            .cloned()
                            .expect("缺少 EasyDo 应用图标"),
                    )
                    .menu(&tray_menu)
                    .tooltip("EasyDo")
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => show_main_window(app),
                        "quick-add" => {
                            show_main_window(app);
                            let _ = app.emit("easydo:quick-add", ());
                        }
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .build(app)?;
            }
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("EasyDo desktop failed to start");
}

#[cfg(test)]
mod tests {
    use super::{badge_count, SNAPSHOT_MIGRATION_SQL};

    #[test]
    fn dock_badge_hides_zero_and_displays_pending_count() {
        assert_eq!(badge_count(0), None);
        assert_eq!(badge_count(12), Some(12));
    }

    #[test]
    fn snapshot_migration_contains_current_and_history_tables() {
        assert!(SNAPSHOT_MIGRATION_SQL.contains("snapshots"));
        assert!(SNAPSHOT_MIGRATION_SQL.contains("snapshot_history"));
        assert!(SNAPSHOT_MIGRATION_SQL.contains("CREATE INDEX"));
    }
}
