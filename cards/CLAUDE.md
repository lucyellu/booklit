# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

Open `ptable_001.html` directly in a modern browser. No build step, no npm, no server required. The app fetches element data at runtime from:
```
https://raw.githubusercontent.com/Bowserinator/Periodic-Table-JSON/master/PeriodicTableJSON.json
```

## Architecture

This is a single-file (`ptable_001.html`) client-side 3D periodic table viewer. All HTML, CSS, and JS live in that one file (~1350 lines).

**Stack**: Three.js (via ES6 import map from CDN) — specifically `CSS3DRenderer`, `TrackballControls`, and `TWEEN.js`.

### Core Concepts

**Element Cards**: Each of the 118 elements is an HTML `<div>` wrapped in a `CSS3DObject` (Three.js). Cards have a front face (symbol, number, name, weight) and back face (density, category, phase, emoji). Colors are assigned by element group (18 groups).

**Layout Modes**: Five named targets — `TABLE`, `SPHERE`, `HELIX`, `GRID`, `MANUAL`. Each computes a target `{x, y, z, rotationX, rotationY}` for every element, then TWEEN animates cards from current to target positions.

**TABLE layout specifics**: The main block (periods 1–7, groups 1–18) is laid out on a grid. The f-block (lanthanides/actinides) can be detached and independently rotated/offset via sliders. The "main block shift %" slider moves the main block left/right to create separation.

**Selection**: Click to select, Ctrl+click for multi-select, Shift+click for range (by atomic number), Escape to clear, Ctrl+A to select all. Press `F` or double-click to focus camera on selected element(s).

**UI Panels**: Left panel has global controls (opacity, multicolor toggle) plus layout-specific sliders that show/hide based on active mode. Right panel is an outliner listing all 118 elements.

### Key Functions

- `init()` — sets up Three.js scene, renderer, camera, controls, loads element data
- `transform(targets, duration)` — tweens all CSS3DObjects to new positions
- `makeTable() / makeSphere() / makeHelix() / makeGrid()` — compute position arrays for each layout
- `onPointerDown/Up/Move` — unified pointer event handler for click vs drag detection
- `focusOnSelected()` — computes camera target from bounding box of selected elements

## Web App Conventions

### Viewport Toggle (Desktop / iPhone emulation)
All single-page web apps in this project should include a desktop/mobile viewport toggle. Add this pattern:

**CSS** — Add before `</style>`:
- `body.iphone-mode` constrains `#app` to 393×852px with 54px border-radius and iPhone box-shadow
- `body.iphone-mode #app::before` creates the Dynamic Island (126×37px pill, top:14px)
- `#bottom-nav` hidden by default, shown via `body.iphone-mode #bottom-nav { display: flex }`
- `body.iphone-mode #sidebar { display: none }` — sidebar replaced by bottom nav on mobile

**HTML** — Add immediately after `<body>`, outside `#app`:
```html
<div id="viewport-toggle">
  <button class="vp-btn active" id="vp-desktop" onclick="setViewport('desktop')">Desktop</button>
  <button class="vp-btn" id="vp-mobile" onclick="setViewport('mobile')">iPhone</button>
</div>
```
Add `#bottom-nav` with `.bottom-nav-item[data-nav]` items just before `</div><!-- end #app -->`.

**JS** — `setViewport(mode)` toggles `body.iphone-mode`, updates button active states, calls `syncBottomNav()`. Bottom nav items click-through to existing sidebar nav items (`.nav-item[data-nav]`).

### Design System — interfacecraft.dev
When building apps in this project, target this visual style:
- **Background**: `#010101`, **Text**: `#F6EBD9` (warm cream on pure black)
- **Accent colors**: `#1D57F6` blue, `#FD73ED` pink, `#00A1F1` cyan, `#E54F10` orange, `#53F399` green, `#FFD102` yellow
- **Font**: `Geist` (Google Fonts) — `https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700`
- **Borders**: `1.5px solid rgba(246,235,217,0.08)` (subtle cream-tinted)
- **Radius**: `4px` (sharp, architectural — not rounded)
- **Letter-spacing**: `-0.03em` on headings, `-0.01em` on body
- **Cards**: solid color background, `1.5px solid rgba(255,255,255,0.1)` border, diagonal stripe pattern at 0.12 opacity
- No gradients in backgrounds — pure solid colors

### Sound Effects (Web Audio API)
Use `playUISound(type)` pattern:
- `'click'` — 680Hz sine, 60ms (button presses)
- `'hover'` — 1100Hz sine, 40ms (card hover, very quiet)
- `'success'` — C-E-G chord arpeggio (action complete)
- `'whoosh'` — filtered noise burst (panel open/close)

## Autonomous Operation

Proceed without asking for permission. Do not pause to confirm before:
- Reading, writing, or editing any file in this project
- Running Python scripts or bash commands (tests, fetch scripts, linters)
- Making HTTP requests to CDNs, Open Library, GitHub, etc.
- Creating files in `data/`, `goodreads/`, or any project subfolder
- Making multiple sequential edits to the same file

Only stop to ask when genuinely blocked (e.g. a command fails and the cause is unclear) or when an action would delete or overwrite work that cannot be recovered.
