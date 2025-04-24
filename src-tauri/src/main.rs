use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use tauri::async_runtime;
use tauri::{
    menu::{AboutMetadata, CheckMenuItemBuilder, MenuBuilder, MenuItem, SubmenuBuilder},
    App, Manager, State, Theme, TitleBarStyle, UserAttentionType, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};

use tauri_plugin_decorum::WebviewWindowExt;
use tauri_plugin_store::StoreExt;
use tauri_plugin_window_state::Builder as WindowStatePlugin;
use tauri_plugin_window_state::StateFlags;

#[derive(Default, Serialize, Deserialize)]
struct AppState {
    autoplay: bool,
}

#[tauri::command]
fn get_autoplay(state: State<'_, Mutex<AppState>>) -> bool {
    let state = state.lock().unwrap();
    state.autoplay
}

#[tauri::command]
fn toggle_autoplay(state: State<'_, Mutex<AppState>>) -> bool {
    let mut state = state.lock().unwrap();
    state.autoplay = !state.autoplay;
    state.autoplay
}

pub fn set_window(app: &mut App, label: &str) -> WebviewWindow {
    let debug = cfg!(debug_assertions);
    let url = WebviewUrl::App(PathBuf::from("https://music.youtube.com/"));
    let user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15";
    let window_builder = WebviewWindowBuilder::new(app, label, url)
        .title("")
        .visible(false)
        .user_agent(user_agent)
        .resizable(true)
        .inner_size(1872.0, 1404.0)
        .disable_drag_drop_handler()
        .initialization_script(&format!("window.__DEBUG_MODE__ = {};", debug))
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
        .plugin(tauri_plugin_store::Builder::new().build())
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
        .invoke_handler(tauri::generate_handler![get_autoplay, toggle_autoplay])
        .setup(move |app| {
            let store = app.store("store.json")?;
            store
                .get("config")
                .map(|config: JsonValue| {
                    let config: AppState = serde_json::from_value(config).unwrap_or_else(|_| {
                        // if the config is not valid, create a new one
                        let config = AppState::default();
                        store.set("config", serde_json::to_value(&config).unwrap());
                        store.save().unwrap();
                        config
                    });
                    app.manage(Mutex::new(config));
                })
                .unwrap_or_else(|| {
                    app.manage(Mutex::new(AppState::default()));
                });
            store.close_resource();

            let setting_check_autoplay = CheckMenuItemBuilder::new("Autoplay on startup")
                .id("autoplay")
                .checked(get_autoplay(app.state()))
                .build(app)?;

            let settings_sub_menu = SubmenuBuilder::new(app, "Settings...")
                .item(&setting_check_autoplay)
                .build()?;

            let custom_quit = MenuItem::with_id(
                app.app_handle(),
                "custom_quit",
                "Quit",
                true,
                Some("Command+Q"),
            )?;

            let app_submenu = SubmenuBuilder::new(app, "App")
                .about(Some(AboutMetadata {
                    ..Default::default()
                }))
                .separator()
                .item(&settings_sub_menu)
                .separator()
                .hide()
                .hide_others()
                .item(&custom_quit)
                .build()?;

            let menu = MenuBuilder::new(app).items(&[&app_submenu]).build()?;

            app.set_menu(menu)?;

            app.on_menu_event(move |app, event| {
                if event.id() == setting_check_autoplay.id() {
                    let enabled = toggle_autoplay(app.state());
                    setting_check_autoplay
                        .set_checked(enabled)
                        .expect("Failed to set checked");
                }
                if event.id() == custom_quit.id() {
                    let state_mutex = app.state::<Mutex<AppState>>();
                    let store = app.store("store.json").unwrap();
                    store.set("config", serde_json::to_value(&*state_mutex.lock().unwrap()).unwrap());
                    store.save().unwrap();
                    store.close_resource();

                    app.exit(0);
                }
            });

            let window = set_window(app, label);

            #[cfg(debug_assertions)]
            {
                window.open_devtools();
            }

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
