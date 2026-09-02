use tauri::Manager;

pub mod data_service;

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

fn show_quick_capture_window(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("quick-capture") {
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }
    tauri::WebviewWindowBuilder::new(
        app,
        "quick-capture",
        tauri::WebviewUrl::App("index.html?capture=1".into()),
    )
    .title("EasyDo 快速收集")
    .inner_size(560.0, 190.0)
    .min_inner_size(460.0, 170.0)
    .always_on_top(true)
    .center()
    .build()
    .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn show_quick_capture(app: tauri::AppHandle) -> Result<(), String> {
    show_quick_capture_window(&app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name("EasyDo")
                .build(),
        )
        .invoke_handler(tauri::generate_handler![set_dock_badge, show_quick_capture])
        .setup(|app| {
            let database_path = app.path().app_config_dir()?.join("easydo.db");
            data_service::start(database_path).map_err(std::io::Error::other)?;
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
                let open_browser = tauri::menu::MenuItem::with_id(
                    app,
                    "open-browser",
                    "在浏览器中打开",
                    true,
                    None::<&str>,
                )?;
                let quit =
                    tauri::menu::MenuItem::with_id(app, "quit", "退出 EasyDo", true, None::<&str>)?;
                let tray_menu =
                    tauri::menu::Menu::with_items(app, &[&show, &quick_add, &open_browser, &quit])?;
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
                            if let Err(error) = show_quick_capture_window(app) {
                                log::error!("无法打开快速收集窗口: {error}");
                            }
                        }
                        "open-browser" => {
                            if let Err(error) = open::that(data_service::DATA_SERVICE_URL) {
                                log::error!("无法打开 EasyDo 网页端: {error}");
                            }
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
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("EasyDo desktop failed to start");
}

#[cfg(test)]
mod tests {
    use super::badge_count;

    #[test]
    fn dock_badge_hides_zero_and_displays_pending_count() {
        assert_eq!(badge_count(0), None);
        assert_eq!(badge_count(12), Some(12));
    }
}
