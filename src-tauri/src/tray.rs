//! Tray icon and its menu. TubeGrab lives in the tray: closing the window hides it and downloads keep running.
//!
//! The menu sends its actions to the frontend as a `tray-action` event (`"pauseAll"`, `"paste"`), because the
//! download queue lives there. "Open TubeGrab" is the first item since some Linux desktops never report a
//! click on the icon itself.

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, Wry};

const TRAY_ID: &str = "main";

pub struct Tray {
    pause_item: MenuItem<Wry>,
}

/// Whether closing the main window hides it to the tray (true) or quits (false). Set from Settings.
pub struct CloseToTray(pub AtomicBool);

pub fn show_main_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
    crate::blur::ensure(app);
}

pub fn build(app: &AppHandle) -> tauri::Result<Tray> {
    let open = MenuItem::with_id(app, "open", "Open TubeGrab", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pauseAll", "Pause all", true, None::<&str>)?;
    let paste = MenuItem::with_id(app, "paste", "Add link from clipboard", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit TubeGrab", true, None::<&str>)?;
    let sep = || PredefinedMenuItem::separator(app);
    let menu = Menu::with_items(app, &[&open, &sep()?, &pause, &paste, &sep()?, &quit])?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("TubeGrab")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "quit" => app.exit(0),
            action => {
                let _ = app.emit("tray-action", action);
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(Tray { pause_item: pause })
}

/// Called by the frontend whenever the queue changes: the tooltip text and whether everything is paused.
#[tauri::command]
pub fn tray_update(
    app: AppHandle,
    tray: State<'_, Tray>,
    tooltip: String,
    all_paused: bool,
) -> Result<(), String> {
    if let Some(icon) = app.tray_by_id(TRAY_ID) {
        icon.set_tooltip(Some(&tooltip))
            .map_err(|e| e.to_string())?;
    }
    tray.pause_item
        .set_text(if all_paused {
            "Resume all"
        } else {
            "Pause all"
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_close_to_tray(state: State<'_, CloseToTray>, enabled: bool) {
    state.0.store(enabled, Ordering::Relaxed);
}
