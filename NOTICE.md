# Webdroid third-party notices

Webdroid's CPU engine is v86, copyright its contributors, under BSD-2-Clause.
Source: https://github.com/copy/v86/tree/589487c7758a2775f606ec631bd78609497f6e05
License: [licenses/v86.txt](licenses/v86.txt).

The Webdroid build adds a `screen_adapter` constructor option to v86's
`src/browser/starter.js`, allowing the WebGPU adapter to replace its display.
The emulator CPU is built from that revision's Rust and C source.

Included components:

- Rust standard library, the Rust Project Developers: [MIT license](rust-license.txt).
- Berkeley SoftFloat 3e, Regents of the University of California:
  [license](softfloat-license.txt).
- Zstandard decompressor, Yann Collet / Facebook:
  [BSD license](zstd-license.txt).
- QEMU floppy controller code, Jocelyn Mayer / Hervé Poussineau:
  [MIT license](licenses/qemu-mit.txt).
- SeaBIOS and VGA BIOS, provided by v86, built from SeaBIOS rel-1.16.2:
  [LGPL license](licenses/seabios.txt).
  Corresponding source and build configuration are included with the release
  downloads; upstream source: https://github.com/coreboot/seabios/tree/rel-1.16.2.

The Android-x86 live image is retrieved by the browser from the upstream v86
demo image host. It is not included in the Webdroid Wasm archive or republished
on this Pages site. Android-x86: https://www.android-x86.org/.

Webdroid's own source repository is private. Downloading browser assets does
not grant additional rights to proprietary third-party apps a user may run.
