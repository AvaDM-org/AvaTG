#!/usr/bin/env bash
# Removes core system libraries from the AppImage that Tauri builds, so the host's own copies are used.
#
#   fix-appimage.sh <AvaTG.AppImage>        (needs appimagetool on PATH; APPIMAGE_RUNTIME = a pinned type2 runtime)
#
# Why: linuxdeploy bundles the build machine's (Ubuntu 22.04) GLib, Wayland, GStreamer, systemd, libelf, libzstd,
# libffi, … next to WebKit. The host's graphics driver (Mesa, LLVM, NVIDIA's EGL) is never bundled, so on a newer
# distro it runs against those older copies of its own dependencies. On Fedora 44 that corrupted WebKitWebProcess's
# memory and it crashed when AvaTG quit. Without them the bundled WebKit uses the host's copies, which are newer and
# backwards compatible on every distro at least as new as the build machine. Same fix as tauri-apps/tauri#15665.
# AvaTG itself drops the AppImage's GStreamer plugin path at startup (src-tauri/src/hostenv.rs).
#
# The updater signature is made afterwards by the release workflow (the AppImage changes here).
set -euo pipefail

appimage=$(realpath "$1")
chmod +x "$appimage" # a file downloaded from a release is not executable
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

(cd "$work" && "$appimage" --appimage-extract >/dev/null)
lib="$work/squashfs-root/usr/lib"

# A bundler update that changes the layout must be noticed here, not by users.
compgen -G "$lib/libglib-2.0.so*" >/dev/null ||
  { echo "::error::libglib-2.0 is not in usr/lib any more; check what linuxdeploy bundles and update $0"; exit 1; }

remove=(
  libwayland-client libwayland-cursor libwayland-egl libwayland-server
  libglib-2.0 libgio-2.0 libgobject-2.0 libgmodule-2.0 libpcre2-8
  libmount libblkid libselinux libsystemd
  libgstreamer-1.0 libgstbase-1.0 libgstapp-1.0 libgstaudio-1.0 libgstvideo-1.0 libgstgl-1.0
  libgstpbutils-1.0 libgsttag-1.0 libgstfft-1.0 libgstallocators-1.0
  libzstd libelf libffi
)
for name in "${remove[@]}"; do
  rm -f "$lib/$name".so*
done
# Anything GStreamer-related that a newer bundler adds.
rm -f "$lib"/libgst*.so*
echo "Removed: ${remove[*]}"

runtime=()
[ -n "${APPIMAGE_RUNTIME:-}" ] && runtime=(--runtime-file "$APPIMAGE_RUNTIME")
ARCH=x86_64 APPIMAGE_EXTRACT_AND_RUN=1 appimagetool "${runtime[@]}" --no-appstream \
  "$work/squashfs-root" "$work/fixed.AppImage" >/dev/null
mv "$work/fixed.AppImage" "$appimage"
chmod 755 "$appimage"
echo "Repacked $appimage"
