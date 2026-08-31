// Windows 发布版本不显示额外的控制台窗口.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    easydo_desktop_lib::run();
}
