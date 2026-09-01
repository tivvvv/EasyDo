use std::path::PathBuf;

fn main() {
    let database_path = std::env::args_os()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(default_database_path);
    if let Err(error) = easydo_desktop_lib::data_service::run_blocking(database_path) {
        eprintln!("EasyDo 本机数据服务未启动: {error}");
        std::process::exit(1);
    }
}

fn default_database_path() -> PathBuf {
    dirs::data_dir()
        .expect("无法确定当前用户的数据目录")
        .join("com.tivvvv.easydo")
        .join("easydo.db")
}
