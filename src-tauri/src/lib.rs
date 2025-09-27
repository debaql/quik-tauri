mod prompts;
use base64::{engine::general_purpose, Engine as _};
use image::{ImageBuffer, Rgba};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::io::Cursor;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::AppHandle;
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_store::{JsonValue, StoreBuilder};
use tauri_plugin_notification::NotificationExt;

// Re-usable Http Client
static HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .build()
        .expect("Failed to build HTTP client")
});

// Shows notification 
fn show_notification(app_handle: &tauri::AppHandle, title: &str, body: &str) {
    app_handle.emit("dismiss_all_notifs", ()).ok();
    let _ = app_handle
        .notification()
        .builder()
        .title(title)
        .body(body)
        .show();
}

// Toggles window visibility
#[tauri::command]
fn toggle_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}
    
// Saves settings to settings.json
#[tauri::command]
fn save_setting(app_handle: AppHandle, key: String, value: String) -> Result<(), String> {
    // Create the store
    let store = StoreBuilder::new(&app_handle, "settings.json")
        .build()
        .map_err(|e| e.to_string())?;

    // Load existing store
    store.reload().map_err(|e| e.to_string())?;

    // Insert key/value
    store.set(key, JsonValue::String(value));

    // Save the store
    store.save().map_err(|e| e.to_string())
}

// Gets VALUE from KEY of settings.json
#[tauri::command]
fn load_setting(app_handle: AppHandle, key: String) -> Result<Option<String>, String> {
    let store = StoreBuilder::new(&app_handle, "settings.json")
        .build()
        .map_err(|e| e.to_string())?;

    store.reload().map_err(|e| e.to_string())?;

    let value = store
        .get(&key)
        .and_then(|v| v.as_str().map(|s| s.to_string()));

    Ok(value)
}

// Gemini
// Request
#[derive(Serialize)]
struct GeminiRequest<'a> {
    contents: Vec<Content<'a>>,
    generation_config: GenerationConfig,
}

#[derive(Serialize)]
struct Content<'a> {
    parts: Vec<Part<'a>>,
}

#[derive(Serialize)]
#[serde(untagged)]
enum Part<'a> {
    Text { text: &'a str },
    InlineData { inline_data: InlineData<'a> },
}

#[derive(Serialize)]
struct InlineData<'a> {
    mime_type: &'a str,
    data: &'a str,
}

// Response
#[derive(Deserialize, Debug)]
struct GeminiResponse {
    candidates: Vec<Candidate>,
}

#[derive(Deserialize, Debug)]
struct Candidate {
    content: ContentResponse,
}

#[derive(Deserialize, Debug)]
struct ContentResponse {
    parts: Vec<PartResponse>,
}

#[derive(Deserialize, Debug)]
struct PartResponse {
    text: String,
}

#[derive(Serialize)]
struct GenerationConfig {
    thinking_config: ThinkingConfig,
}

#[derive(Serialize)]
struct ThinkingConfig {
    thinking_budget: i32,
}

#[tauri::command]
async fn call_gemini_api(app_handle: tauri::AppHandle, api_key: String, model: String, thinking_mode: String, image_data: String) -> Result<String, String> {
    // Displays a notification "Processing" if the window is hidden
    if let Some(window) = app_handle.get_webview_window("main") {
        if !window.is_visible().unwrap_or(true) {
            show_notification(&app_handle, "Processing", "Please wait...");
        }
    }

    // Gemini API Url
    let api_url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
        model
    );

    let prompt = prompts::PROMPT;

    let request_body = GeminiRequest {
        contents: vec![Content {
            parts: vec![
                Part::Text { text: prompt },
                Part::InlineData {
                    inline_data: InlineData {
                        mime_type: "image/png",
                        data: &image_data,
                    },
                },
            ],
        }],
        generation_config: GenerationConfig {
            thinking_config: ThinkingConfig { 
            // Value of -1 means unlimited, of 0 means no thinking
            thinking_budget: if thinking_mode == "true" { -1 } else { 0 } 
            },
        },
    };

    let client = &*HTTP_CLIENT;

    let res = client
        .post(api_url)
        .json(&request_body)
        .header("Content-Type", "application/json")
        // API Key is sent here
        .header("X-goog-api-key", api_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let response_data: GeminiResponse = res.json().await.map_err(|e| e.to_string())?;
        if let Some(candidate) = response_data.candidates.get(0) {
            if let Some(part) = candidate.content.parts.get(0) {
                // Displays a notification "Done" if the window is hidden
                if let Some(window) = app_handle.get_webview_window("main") {
                    if !window.is_visible().unwrap_or(true) {
                        show_notification(&app_handle, "Done", "Translation Complete!");
                    }
                }
                return Ok(part.text.clone());
            }
        }
        Err("No content found in response".to_string())
    } else {
        if let Some(window) = app_handle.get_webview_window("main") {
            if !window.is_visible().unwrap_or(true) {
                show_notification(&app_handle, "Error", "An error occured");
            }
        }
        let error_body = res.text().await.map_err(|e| e.to_string())?;
        Err(format!("API call failed: {}", error_body))
    }
}

// Translates from clipboard
#[tauri::command]
async fn translate_from_clipboard(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Load the store
    let store = StoreBuilder::new(&app_handle, "settings.json")
        .build()
        .map_err(|e| e.to_string())?;
    store.reload().map_err(|e| e.to_string())?;

    // Get value of 'apiKey'
    let api_key = match store
        .get("apiKey")
        .and_then(|v| v.as_str().map(String::from))
    {
        Some(key) if !key.is_empty() => key,
        _ => return Err("API Key is not configured in settings.".to_string()),
    };

    // Get value of 'model'
    let model = match store
        .get("model")
        .and_then(|v| v.as_str().map(String::from))
    {
        Some(key) if !key.is_empty() => key,
        _ => return Err("Model is not configured in settings.".to_string()),
    };

    // Get value of 'thinkingMode'
    let thinking_mode = match store
        .get("thinkingMode")
        .and_then(|v| v.as_str().map(String::from))
    {
        Some(key) if !key.is_empty() => key,
        _ => return Err("Thinking Mode is not configured in settings.".to_string()),
    };

    // This event is intended to update the UI on the frontend
    let clipboard = app_handle.clipboard();
    app_handle.emit("translation_status", "processing").unwrap();

    // Try to read image on clipboard
    match clipboard.read_image() {
        Ok(image) => {
            // Create an image buffer from the raw RGBA data
            let img_buffer = ImageBuffer::<Rgba<u8>, _>::from_raw(
                image.width() as u32,
                image.height() as u32,
                image.rgba(),
            )
            .ok_or("Failed to create image buffer from clipboard data.")?;

            // Encode the buffer as a PNG into an in-memory cursor (a virtual file)
            let mut png_bytes: Cursor<Vec<u8>> = Cursor::new(Vec::new());
            img_buffer
                .write_to(&mut png_bytes, image::ImageFormat::Png)
                .map_err(|e| e.to_string())?;

            // Base64 encode the resulting PNG bytes
            let image_b64 = general_purpose::STANDARD.encode(png_bytes.into_inner());

            // Call the Gemini API with the loaded key
            match call_gemini_api(app_handle.clone(), api_key, model, thinking_mode, image_b64).await {
                Ok(res) => {
                    app_handle.emit("translation_status", res).unwrap();
                    Ok(())
                }
                Err(e) => {
                    app_handle
                        .emit("translation_status", format!("error: {}", e))
                        .unwrap();
                    Err(e)
                }
            }
        }
        Err(e) => {
            if let Some(window) = app_handle.get_webview_window("main") {
                if !window.is_visible().unwrap_or(true) {
                    show_notification(&app_handle, "Error", "An error occured");
                }
            }
            let err_msg = format!("error: No image found on the clipboard. {}", e);
            app_handle
                .emit("translation_status", err_msg.clone())
                .unwrap();
            Err(err_msg)
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            toggle_window,
            save_setting,
            load_setting,
            translate_from_clipboard,
            call_gemini_api
        ])
        .setup(|app| {

            // Sets default values of store
            let store = tauri_plugin_store::StoreBuilder::new(app.handle(), "settings.json")
            .build()?;

            store.reload().ok();

            if store.get("model").is_none() {
                store.set("model", JsonValue::String("gemini-2.5-flash".into())); // Default model
            }

            if store.get("thinkingMode").is_none() {
                store.set("thinkingMode", JsonValue::String("true".into())); // ThinkingMode is on by default
            }

            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_global_shortcut::Builder::new().build())?;

            // Create menu items
            let show_item = MenuItem::with_id(app, "show", "Show App", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            // Build the menu from those items
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            // Build tray icon and attach menu + event handlers
            TrayIconBuilder::new()
                // use app's default icon
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app_handle, menu_event| {
                    match menu_event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app_handle.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| match event {
                    // On double click, show/unhide the main window
                    TrayIconEvent::DoubleClick { button: _, .. } => {
                        let app_handle = tray.app_handle();
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                window.hide().unwrap();
                api.prevent_close();
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
