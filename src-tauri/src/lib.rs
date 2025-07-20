use std::sync::{Arc, Mutex};
use tauri::async_runtime::spawn;
use tauri::Emitter;
use tauri::Manager;
use tauri::State;
use tauri_plugin_prevent_default::Flags;
use tokio::sync::broadcast;

// SharedSender is a thread-safe, shared broadcast channel for synchronizing messages between windows.
type SharedSender = Arc<Mutex<Option<broadcast::Sender<String>>>>;

/// Starts the global sync server for inter-window communication.
/// Initializes a broadcast channel and stores the sender in shared state.
#[tauri::command]
fn start_sync_server(state: State<SharedSender>) {
    let sender = state.inner().clone();
    spawn(async move {
        let (tx, _rx) = broadcast::channel::<String>(100);
        *sender.lock().unwrap() = Some(tx);
    });
}

/// Sends a sync message to all subscribed windows.
/// Returns Ok(()) even if no windows are currently subscribed.
#[tauri::command]
async fn send_sync_message(state: State<'_, SharedSender>, msg: String) -> Result<(), ()> {
    if let Some(sender) = &*state.lock().unwrap() {
        let _ = sender.send(msg);
    }
    Ok(())
}

/// Subscribes the given window to sync messages.
/// Each message received is emitted as a "sync-message" event to the window.
#[tauri::command]
async fn subscribe_sync(state: State<'_, SharedSender>, window: tauri::Window) -> Result<(), ()> {
    let rx = {
        let sender = state.lock().unwrap();
        sender.as_ref().unwrap().subscribe()
    };
    spawn(async move {
        let mut rx = rx;
        while let Ok(msg) = rx.recv().await {
            let _ = window.emit("sync-message", msg);
        }
    });
    Ok(())
}

/// Immediately quits the application.
#[tauri::command]
fn quit() {
    std::process::exit(0x0);
}

/// Creates a new window with the specified parameters, or focuses an existing one with the same ID.
///
/// # Arguments
/// * `id` - The window ID.
/// * `url` - The URL or path to load in the window.
/// * `x`, `y` - The window position.
/// * `w`, `h` - The window size.
/// * `title` - The window title.
/// * `resizable`, `maximizable`, `transparent`, `decorations`, `focused` - Optional window flags.
/// * `handle` - The Tauri app handle.
#[tauri::command]
async fn create_window(
    id: &str,
    url: &str,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    title: &str,
    resizable: Option<bool>,
    maximizable: Option<bool>,
    transparent: Option<bool>,
    decorations: Option<bool>,
    focused: Option<bool>,
    handle: tauri::AppHandle,
) -> Result<(), String> {
    let resizable = resizable.unwrap_or(false); // Default to false if not provided
    let maximizable = maximizable.unwrap_or(false); // Default to false if not provided
    let transparent = transparent.unwrap_or(true); // Default to true if not provided
    let decorations = decorations.unwrap_or(true);
    let focused = focused.unwrap_or(true); // Default to true if not provided
    if let Some(window) = handle.get_webview_window(id) {
        // If the window already exists, bring it to front
        let _ = window.set_focus();
        Ok(())
    } else {
        // Otherwise, create the window
        tauri::WebviewWindowBuilder::new(&handle, id, tauri::WebviewUrl::App(url.into()))
            .position(x, y)
            .inner_size(w, h)
            .title(title)
            .resizable(resizable)
            .maximizable(maximizable)
            .transparent(transparent)
            .decorations(decorations)
            .focused(focused)
            .build()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
}

/// Closes the window with the given ID, if it exists.
#[tauri::command]
async fn close_window(id: &str, handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = handle.get_webview_window(id) {
        let _ = window.close();
        Ok(())
    } else {
        Err(format!("Window with ID '{}' not found", id))
    }
}

/// Returns the current window's ID as a string.
#[tauri::command]
async fn get_current_window_id(window: tauri::Window) -> Result<String, String> {
    let id = window.label();
    Ok(id.to_string())
}

/// Creates a Tauri plugin to prevent default actions (e.g., disables dev tools by default).
fn create_prevent_plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri_plugin_prevent_default::Builder::new()
        .with_flags(Flags::all().difference(Flags::DEV_TOOLS))
        .build()
}

/// Main entry point for the Tauri application.
/// Sets up plugins, manages shared state, and registers all Tauri commands.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let shared_sender: SharedSender = Arc::new(Mutex::new(None));
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        // .plugin(tauri_plugin_single_instance::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(shared_sender)
        .plugin(tauri_plugin_notification::init())
        .plugin(create_prevent_plugin())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = app
                .get_webview_window("main")
                .expect("no main window")
                .set_focus();
        }))
        .invoke_handler(tauri::generate_handler![
            quit,
            create_window,
            close_window,
            get_current_window_id,
            start_sync_server,
            send_sync_message,
            subscribe_sync
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
