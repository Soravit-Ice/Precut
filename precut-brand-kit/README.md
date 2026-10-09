# precut — Brand Asset Kit

Production-ready file set recreated as **independent SVG vectors** from the latest precut brand concept.
The original AI-generated identity board was a visual mockup, not an editable source: the paths here were carefully redrawn to match that direction. These are real independent assets (not cropped pieces of a presentation board).

## Brand colors

- Deep Navy: `#07111F`
- Primary Blue: `#075EF7`
- Electric Blue: `#168BFF`
- Bright Cyan: `#36C5FF`
- Mint: `#22D3B6` (reserved for interface accents)
- White: `#FFFFFF`

## macOS / Windows app logos — `desktop/`

- `precut-macos.icns` — native macOS icon, embedded PNG representations from 16 to 1024px.
- `precut-windows.ico` — Windows installer/executable icon with 16–256px representations.
- `precut-app-icon.svg` — editable, resolution-independent app icon.
- `precut-app-icon-1024.png`, `-512.png`, `-256.png`, `-128.png`, `-64.png`, `-48.png`, `-32.png`, `-24.png`, `-16.png` — individually exported transparent-canvas PNGs, each containing a rounded navy square.
- `precut-app-icon-light.svg` / `precut-app-icon-light-1024.png` — light background.
- `precut-app-icon-monochrome.svg` / `precut-app-icon-monochrome-1024.png` — one-color symbol.

## Website — `website/`

- `precut-logo-on-light.svg/png` — blue/cyan symbol + navy wordmark; transparent canvas, use on light pages.
- `precut-logo-on-dark.svg/png` — blue/cyan symbol + white wordmark; transparent canvas, use on dark pages.
- `precut-logo-mono-dark.svg/png` and `precut-logo-mono-light.svg/png` — monochrome lockups.
- `precut-symbol.svg` / `precut-symbol-512.png` / `precut-symbol-1024.png` — transparent standalone brand mark.
- `favicons/` — favicon SVG/ICO/PNG, Apple touch icon 180px, Android icons 192/512px, and sample web manifest.
- `social/` — social profile avatar and Open Graph image.

## Separate brand assets — `brand/`

- `precut-symbol-primary.svg/png` — standalone blue/cyan folded P.
- `precut-symbol-dark.svg/png` — solid deep navy version.
- `precut-symbol-white.svg/png` — solid white version.
- `precut-wordmark-dark.svg/png`, `precut-wordmark-light.svg/png`, `precut-wordmark-brand-blue.svg/png` — wordmark-only files.

## Install in a web project

Copy `website/favicons/` files into your website's public folder (`public/`).
Use an SVG logo directly; SVGs include outlined letterforms, **no fonts are required**.

For HTML/Astro:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" sizes="any" href="/favicon.ico" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />
<img src="/precut-logo-on-light.svg" alt="precut" width="557" height="162" />
```

For an Electron project using electron-builder:

```yaml
build:
  mac:
    icon: assets/precut-macos.icns
  win:
    icon: assets/precut-windows.ico
```

## Notes / หมายเหตุ

- Every visual file is separate. PNGs are exported with transparent outer canvases; colored app-icon backgrounds are **part of the intentional icon**.
- SVGs are real vector shapes with outlined text — production-ready for web implementation.
- The native ICNS and ICO files are assembled with multiple embedded raster sizes.
- สีฟ้าและกรมท่าใช้เป็นสีหลัก ส่วนสีเขียวมิ้นต์เก็บไว้เป็น accent ของ UI
- ไฟล์ SVG สามารถขยายได้โดยไม่แตก และ PNG พื้นหลังภายนอกโปร่งใส
- ภาพต้นฉบับเป็น AI mockup จึงมีการวาดทรงเวกเตอร์ขึ้นใหม่ โดยอิงดีไซน์ล่าสุด ไม่ใช่การส่งไฟล์ต้นฉบับจากโปรแกรมออกแบบ
