//! Blur behind the window (the "glass"), asked from the OS like AvaDM does through Avalonia:
//! - Windows: acrylic (falls back to the older blur-behind); macOS: vibrancy. Both through `window-vibrancy`.
//! - Linux on Wayland: the standard `ext_background_effect_v1` protocol (KWin 6.8+), else KWin's older
//!   `org_kde_kwin_blur`, on the window's own Wayland surface.
//! - Anything else (GNOME, compositors without either protocol, X11 sessions): no blur. The frontend then keeps the window nearly
//!   solid so it stays readable (`window_blur` reports which case applies).

use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

/// Whether the OS blurs what is behind the window; None until the window has been on screen.
#[derive(Default)]
pub struct BlurState(Mutex<Option<bool>>);

/// What is known so far (false until the blur has been applied). The page also gets a `window-blur` event.
#[tauri::command]
pub fn window_blur(state: tauri::State<'_, BlurState>) -> bool {
    state.0.lock().ok().and_then(|k| *k).unwrap_or(false)
}

/// Apply the blur once the main window is on screen. Call after showing the window; later calls do nothing.
/// The window gets its native surface a moment after `show()`, so this retries for a few seconds.
pub fn ensure(app: &AppHandle) {
    if app
        .state::<BlurState>()
        .0
        .lock()
        .ok()
        .and_then(|k| *k)
        .is_some()
    {
        return;
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        for _ in 0..20 {
            tokio::time::sleep(Duration::from_millis(150)).await;
            let (tx, rx) = std::sync::mpsc::channel();
            let handle = app.clone();
            // GTK must be called on the main thread.
            let _ = app.run_on_main_thread(move || {
                let result = handle.get_webview_window("main").and_then(|w| apply(&w));
                let _ = tx.send(result);
            });
            let Ok(Some(granted)) = rx.recv() else {
                continue;
            };
            if let Ok(mut known) = app.state::<BlurState>().0.lock() {
                *known = Some(granted);
            }
            let _ = app.emit("window-blur", granted);
            return;
        }
    });
}

/// Ask for blur behind `window`: Some(granted), or None when the window has no native surface yet.
fn apply(window: &WebviewWindow) -> Option<bool> {
    #[cfg(windows)]
    {
        use window_vibrancy::{apply_acrylic, apply_blur};
        let tint = Some((16, 21, 28, 120));
        return Some(apply_acrylic(window, tint).is_ok() || apply_blur(window, tint).is_ok());
    }
    #[cfg(target_os = "macos")]
    {
        use window_vibrancy::{NSVisualEffectMaterial, apply_vibrancy};
        return Some(
            apply_vibrancy(window, NSVisualEffectMaterial::HudWindow, None, Some(14.0)).is_ok(),
        );
    }
    #[cfg(target_os = "linux")]
    {
        return match wayland::apply(window) {
            Ok(()) => Some(true),
            Err(wayland::Error::NotReady) => None,
            Err(wayland::Error::Denied(e)) => {
                eprintln!("No blur behind the window: {e}");
                Some(false)
            }
        };
    }
    #[allow(unreachable_code)]
    {
        let _ = window;
        Some(false)
    }
}

#[cfg(target_os = "linux")]
mod wayland {
    use gtk::glib::translate::ToGlibPtr;
    use gtk::prelude::*;
    use std::ffi::c_void;
    use tauri::WebviewWindow;
    use wayland_client::backend::{Backend, ObjectId};
    use wayland_client::globals::{GlobalList, GlobalListContents, registry_queue_init};
    use wayland_client::protocol::{
        wl_compositor::WlCompositor, wl_region::WlRegion, wl_registry, wl_surface::WlSurface,
    };
    use wayland_client::{
        Connection, Dispatch, EventQueue, Proxy, QueueHandle, WEnum, delegate_noop,
    };
    use wayland_protocols::ext::background_effect::v1::client::{
        ext_background_effect_manager_v1::{self, Capability, ExtBackgroundEffectManagerV1},
        ext_background_effect_surface_v1::ExtBackgroundEffectSurfaceV1,
    };
    use wayland_protocols_plasma::blur::client::{
        org_kde_kwin_blur::OrgKdeKwinBlur, org_kde_kwin_blur_manager::OrgKdeKwinBlurManager,
    };

    // GDK's Wayland accessors (in libgdk-3, which Tauri already links).
    unsafe extern "C" {
        fn gdk_wayland_window_get_wl_surface(window: *mut gdk_sys::GdkWindow) -> *mut c_void;
        fn gdk_wayland_display_get_wl_display(display: *mut gdk_sys::GdkDisplay) -> *mut c_void;
    }

    pub enum Error {
        /// The window has no native surface yet: try again shortly.
        NotReady,
        /// The compositor cannot blur this window.
        Denied(String),
    }

    impl From<String> for Error {
        fn from(e: String) -> Self {
            Error::Denied(e)
        }
    }

    #[derive(Default)]
    struct State {
        /// Capabilities announced by ext_background_effect_manager_v1.
        blur_supported: bool,
    }

    impl Dispatch<wl_registry::WlRegistry, GlobalListContents> for State {
        fn event(
            _: &mut Self,
            _: &wl_registry::WlRegistry,
            _: wl_registry::Event,
            _: &GlobalListContents,
            _: &Connection,
            _: &QueueHandle<Self>,
        ) {
        }
    }

    impl Dispatch<ExtBackgroundEffectManagerV1, ()> for State {
        fn event(
            state: &mut Self,
            _: &ExtBackgroundEffectManagerV1,
            event: ext_background_effect_manager_v1::Event,
            _: &(),
            _: &Connection,
            _: &QueueHandle<Self>,
        ) {
            if let ext_background_effect_manager_v1::Event::Capabilities {
                flags: WEnum::Value(flags),
            } = event
            {
                state.blur_supported = flags.contains(Capability::Blur);
            }
        }
    }

    delegate_noop!(State: ignore WlCompositor);
    delegate_noop!(State: ignore WlRegion);
    delegate_noop!(State: ignore ExtBackgroundEffectSurfaceV1);
    delegate_noop!(State: ignore OrgKdeKwinBlurManager);
    delegate_noop!(State: ignore OrgKdeKwinBlur);

    pub fn apply(window: &WebviewWindow) -> Result<(), Error> {
        if !window.is_visible().unwrap_or(false) {
            return Err(Error::NotReady);
        }
        let gtk_window = window.gtk_window().map_err(|e| e.to_string())?;
        let Some(gdk_window) = gtk_window.window() else {
            return Err(Error::NotReady);
        };
        let display = gdk_window.display();
        if display.type_().name() != "GdkWaylandDisplay" {
            return Err(Error::Denied("not a Wayland session".into()));
        }
        // SAFETY: both are Wayland GDK objects (checked above) that live as long as the window.
        let (wl_display, wl_surface) = unsafe {
            (
                gdk_wayland_display_get_wl_display(display.to_glib_none().0),
                gdk_wayland_window_get_wl_surface(gdk_window.to_glib_none().0),
            )
        };
        if wl_display.is_null() || wl_surface.is_null() {
            return Err(Error::NotReady);
        }

        // Talk to the compositor on GTK's own connection, with a queue of our own.
        // SAFETY: the display pointer comes from GDK and stays valid for the whole process.
        let conn =
            Connection::from_backend(unsafe { Backend::from_foreign_display(wl_display.cast()) });
        let (globals, mut queue) =
            registry_queue_init::<State>(&conn).map_err(|e| e.to_string())?;
        let qh = queue.handle();
        // SAFETY: a live wl_surface owned by GDK.
        let surface_id = unsafe { ObjectId::from_ptr(WlSurface::interface(), wl_surface.cast()) }
            .map_err(|e| e.to_string())?;
        let surface = WlSurface::from_id(&conn, surface_id).map_err(|e| e.to_string())?;

        let applied = background_effect(&globals, &mut queue, &qh, &surface)
            .or_else(|_| kwin_blur(&globals, &mut queue, &qh, &surface));
        // Blur takes effect on the surface's next commit: GTK's next frame.
        gtk_window.queue_draw();
        Ok(applied?)
    }

    /// ext_background_effect_v1: a blur region covering the whole surface (the compositor clips it).
    fn background_effect(
        globals: &GlobalList,
        queue: &mut EventQueue<State>,
        qh: &QueueHandle<State>,
        surface: &WlSurface,
    ) -> Result<(), String> {
        let manager: ExtBackgroundEffectManagerV1 =
            globals.bind(qh, 1..=1, ()).map_err(|e| e.to_string())?;
        let compositor: WlCompositor = globals.bind(qh, 1..=6, ()).map_err(|e| e.to_string())?;
        let mut state = State::default();
        queue.roundtrip(&mut state).map_err(|e| e.to_string())?;
        if !state.blur_supported {
            return Err("the compositor offers background effects but not blur".into());
        }
        let region = compositor.create_region(qh, ());
        region.add(0, 0, i32::from(i16::MAX), i32::from(i16::MAX));
        let effect = manager.get_background_effect(surface, qh, ());
        effect.set_blur_region(Some(&region));
        region.destroy();
        queue.roundtrip(&mut state).map_err(|e| e.to_string())?;
        // The effect object must live as long as the window; it is never destroyed.
        std::mem::forget(effect);
        Ok(())
    }

    /// KWin before 6.8: org_kde_kwin_blur with no region means the whole surface.
    fn kwin_blur(
        globals: &GlobalList,
        queue: &mut EventQueue<State>,
        qh: &QueueHandle<State>,
        surface: &WlSurface,
    ) -> Result<(), String> {
        let manager: OrgKdeKwinBlurManager = globals
            .bind(qh, 1..=1, ())
            .map_err(|_| "the compositor has no blur protocol (or its Blur effect is off)")?;
        let blur = manager.create(surface, qh, ());
        blur.commit();
        queue
            .roundtrip(&mut State::default())
            .map_err(|e| e.to_string())?;
        std::mem::forget(blur);
        Ok(())
    }
}
