fn main() {
    tauri_build::build();
    // 本机网页由 include_dir 嵌入, 前端更新后必须重新编译数据服务.
    println!("cargo:rerun-if-changed=../../web/dist");
}
