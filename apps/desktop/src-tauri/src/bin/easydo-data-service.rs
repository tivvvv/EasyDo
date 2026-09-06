use std::{ffi::OsString, path::PathBuf};

use easydo_desktop_lib::data_service::{run_blocking, DATA_SERVICE_PORT};

fn main() {
    let result = service_options(&std::env::args_os().skip(1).collect::<Vec<_>>())
        .and_then(|(database_path, port)| run_blocking(database_path, port));
    if let Err(error) = result {
        eprintln!("EasyDo 本机数据服务未启动: {error}");
        std::process::exit(1);
    }
}

fn service_options(args: &[OsString]) -> Result<(PathBuf, u16), String> {
    match args {
        [] => Ok((default_database_path(), DATA_SERVICE_PORT)),
        [mode] if mode == "--e2e" => Ok((
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target/e2e/easydo.db"),
            24_874,
        )),
        [path] if !path.to_string_lossy().starts_with('-') => {
            Ok((PathBuf::from(path), DATA_SERVICE_PORT))
        }
        _ => Err("用法: easydo-data-service [数据库路径 | --e2e].".to_string()),
    }
}

fn default_database_path() -> PathBuf {
    dirs::data_dir()
        .expect("无法确定当前用户的数据目录")
        .join("com.tivvvv.easydo")
        .join("easydo.db")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn e2e_mode_uses_an_isolated_port_and_database() {
        let (path, port) = service_options(&["--e2e".into()]).unwrap();
        assert_eq!(port, 24_874);
        assert_ne!(port, DATA_SERVICE_PORT);
        assert!(path.ends_with("target/e2e/easydo.db"));
        assert_ne!(path, default_database_path());
    }

    #[test]
    fn e2e_mode_rejects_database_overrides() {
        assert!(service_options(&["--e2e".into(), "real.db".into()]).is_err());
        assert!(service_options(&["--unknown".into()]).is_err());
    }

    #[test]
    fn development_keeps_the_default_data_service() {
        assert_eq!(
            service_options(&[]).unwrap(),
            (default_database_path(), DATA_SERVICE_PORT)
        );
        assert_eq!(
            service_options(&["custom.db".into()]).unwrap(),
            (PathBuf::from("custom.db"), DATA_SERVICE_PORT)
        );
    }
}
