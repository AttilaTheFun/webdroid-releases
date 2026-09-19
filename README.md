# Webdroid

**[Run Android in your browser](https://attilathefun.github.io/webdroid-releases/)**

A real Android-x86 4.4 guest running locally through WebAssembly, with WebGPU
framebuffer presentation. Tested in Safari on an iPhone 15 Pro running iOS
26.6.2. No remote VM, native app installation, jailbreak, or JIT helper.

1. Open the link in Safari 26+ or another browser with WebGPU.
2. Press **Start Android** and keep the tab active. First boot can take a
   couple of minutes; the Android disk downloads in chunks as needed.
3. Dismiss Android's welcome tips. Tap apps, drag to swipe, or use the Back,
   Home, and Keyboard controls below the display.

## Downloads

[Releases](https://github.com/AttilaTheFun/webdroid-releases/releases) contain:

- `webdroid.tar.gz`: the browser host, source-built Wasm emulator, BIOS, notices.
- `v86.wasm`: the compiled CPU engine, also included in the bundle.
- `third-party-sources.tar.gz`: upstream emulator/BIOS source and BIOS configs.
- `SHA256SUMS`: download checksums.

## Current scope

This preview runs **Android 4.4 / x86**, not current Android or ARM-only APKs.
Built-in Android apps work. The guest renders in software; WebGPU presents
its display. Sessions reset on reload. Guest internet, Google Play, persistent
storage, an APK import UI, and accelerated guest 3D are not included yet.

The Android image loads from the original public v86 image host and is not
redistributed here. See [third-party notices](NOTICE.md).

Webdroid's Bazel build and application source are maintained in a separate
private repository. This public repository contains the runnable site and
release artifacts.
