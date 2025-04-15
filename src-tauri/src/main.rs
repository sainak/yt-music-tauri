use std::path::PathBuf;

use tauri::{
    App, Manager, Theme, TitleBarStyle, UserAttentionType, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};

use tauri::async_runtime;

use tauri_plugin_decorum::WebviewWindowExt;
use tauri_plugin_window_state::Builder as WindowStatePlugin;
use tauri_plugin_window_state::StateFlags;

pub fn set_window(app: &mut App, label: &str) -> WebviewWindow {
    let url = WebviewUrl::App(PathBuf::from("https://music.youtube.com/"));
    let user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15";
    let window_builder = WebviewWindowBuilder::new(app, label, url)
        .title("")
        .visible(false)
        .user_agent(user_agent)
        .resizable(true)
        .inner_size(1872.0, 1404.0)
        .disable_drag_drop_handler()
        .initialization_script(include_str!("./inject/main.js"))
        .title_bar_style(TitleBarStyle::Overlay)
        .theme(Some(Theme::Dark));

    window_builder.build().expect("Failed to build window")
}

pub fn main() {
    // let label: &str = if cfg!(debug_assertions) {
    //     "debug"
    // } else {
    //     "main"
    // };

    let label: &str = "main";

    tauri::Builder::default()
        .plugin(
            WindowStatePlugin::default()
                .with_state_flags(
                    // Prevent flickering on the first open.
                    StateFlags::all() & !(StateFlags::VISIBLE | StateFlags::FULLSCREEN),
                )
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            let window = app.get_webview_window(label).unwrap();
            window.set_focus().unwrap();
            window
                .request_user_attention(Some(UserAttentionType::Informational))
                .unwrap()
        }))
        .plugin(tauri_plugin_decorum::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(move |app| {
            let window = set_window(app, label);

            #[cfg(debug_assertions)] { window.open_devtools(); }

            window.create_overlay_titlebar().unwrap();
            // Set a custom inset to the traffic lights
            window.set_traffic_lights_inset(8.0, 8.0).unwrap();
            // Make window transparent without privateApi
            // window.make_transparent().unwrap();
            window.show().unwrap();
            Ok(())
        })
        .on_window_event(|_window, _event| match _event {
            WindowEvent::CloseRequested { api, .. } => {
                let window = _window.clone();
                async_runtime::spawn(async move {
                    if window.is_fullscreen().unwrap_or(false) {
                        window.set_fullscreen(false).unwrap();
                    }
                    window.minimize().unwrap();
                    window.hide().unwrap();
                });
                api.prevent_close();
            }
            WindowEvent::Resized(_) => {
                std::thread::sleep(std::time::Duration::from_nanos(1));
            }
            _ => (),
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
