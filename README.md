# HIA-Theme-Builder

English | [简体中文](README.zh-CN.md)

HIA Theme Builder. Rebuilds the original single-file tool `HIA_theme_manager.html` into a reusable, publishable theme management system based on TypeScript and componentization, with a shared core (`core`) from which the web, Electron and Tauri editions are derived.

**Current release [v0.4.0](https://github.com/mandolin/HIA-Theme-Builder/releases/tag/v0.4.0)** (2026-11-12): three-end consistent release · [Web app (GitHub Pages)](https://mandolin.github.io/HIA-Theme-Builder/) · [Docs](https://mandolin.github.io/HIA-Theme-Builder/docs/) · [Desktop downloads](https://github.com/mandolin/HIA-Theme-Builder/releases)

## Feature Overview

- **Theme console**: primary candidate library (44 colors), secondary candidate area, name/category/industry metadata; apply or generate-and-import themes in one click.
- **Harmony modes & auxiliary colors** (ADR-007 v2): body color in single/dual/triad modes (derived from member count); ten classic color designs mapped to relation rules (complement/clash/neutral/analogous/split-complement/tertiary/primary-combo/secondary-combo/pure/manual); one-click "fill secondary / fill third"; auxiliary slots (0..12, manual or rule-generated, ↔Pri/↔Sec/↔3rd swaps, drag to reorder).
- **Color baodian picker**: modal with 24 moods × 10 forms (1,440 combos / 3,739 bars, reconciled zero-missing against the source book); click a combo to apply; per-mood ⚡ quick apply.
- **Six color sources**: baodian combos, traditional named colors (1,637 across EN/CN/JA/KR with notes), national flags (196 countries & regions, bundled flag images), brand palettes (691 brands, bundled logos), natural scenes (41), social conventions (31) — switch via the "Baodian pick" split button.
- **URL color exploration** (desktop): real-render extraction with multi-signal scoring (text/borders/logo/manifest), dual-layer SSRF protection (Electron main process + Tauri Rust per-request CDP adjudication); apply-scope checkboxes (primary & secondary, other colors → auxiliary).
- **Previews**: full fake enterprise admin (dashboard/list/form/detail/analytics/settings × three layouts × dark/light) + mini-program sample pages + WordPress/Tailwind classic-target injection previews.
- **Gradients**: 8 gradient roles × color sources (primary/secondary/third/auxiliary N) × shade/angle/bias, custom dropdown with swatch previews.
- **Tone presets & anchoring**: 72 built-in mood presets applied as full suites; anchor mode re-derives combos from your current primary.
- **Preview filters**: alpha fade / desaturate / brightness / grayscale 25-50-100%, preview-only, persisted.
- **Exports**: CSS variables / JSON tokens / WordPress theme.json + child-theme skeleton / Tailwind config; third & auxiliary colors propagate everywhere.
- **Theme market**: local library (search/category/industry filters), pack import & export, share links (URL restores a theme), remote preset sources (official example source built in).
- **i18n & a11y**: bilingual UI (zh/en, lossless round-trips), ARIA/keyboard baseline; docs site bilingual with language switch.

| Entry | Description |
| --- | --- |
| Web edition (`HIA/web`) | Online theme building and preview, deployed to GitHub Pages; the shared renderer is the single source of truth for all three UIs. |
| Electron edition (`HIA/electron`) | Desktop edition reusing the shared renderer; adds real-render URL color extraction. |
| Tauri edition (`HIA/tauri`) | Lighter desktop edition reusing the shared renderer; adds real-render URL color extraction. |
| Shared core (`HIA/core`) | Theme model, color algorithms, token export and preview components consumed by every end. |

> Cross-end consistency: desktop editions never rewrite the UI — they reuse the Vite build output of `HIA/web` (`index.html` + `assets`), so presentation and behavior match everywhere; desktop-only capabilities (URL extraction) plug in through each platform bridge (`window.hia.extractFromUrl` / `__TAURI_INVOKE__('extract_signals')`) via the `createAdaptivePlatform` fallback chain.
>
> Identical extraction: the scanner bundle injected by Electron and embedded into Tauri via `include_str!` both come from the same `HIA/extractor/dist/browser-scanner.bundle.js` (self-contained IIFE); a script verifies the bundle hash across ends so scores are reproducible.

## Repository & Boundaries

This project is a mono-repo: the top folder `HIA-Theme-Builder/` is the **public main repository** (mapped to `mandolin/HIA-Theme-Builder`); `work-zone/` is an independent **private workspace repository** (mapped to `mandolin/HIA-Theme-Builder-WorkZone`) excluded by the root `.gitignore`.

| Location | Responsibility | Repository |
| --- | --- | --- |
| `HIA/core/` | Shared theme model, color algorithms, token export, reusable preview components. | Public |
| `HIA/web/` | Web app, deployed to GitHub Pages. | Public |
| `HIA/electron/` | Electron desktop edition, reusing the web renderer with URL extraction. | Public |
| `HIA/tauri/` | Tauri desktop edition, reusing the web renderer with URL extraction. | Public |
| `docs/` | Public docs for users and contributors. | Public |
| `docs-site/` | Bilingual docs subsite deployed under `/docs/` on GitHub Pages. | Public |
| `dev/` | Curated public development materials (may be empty). | Public |
| `work-zone/` | Private planning, research, audits and AI-collaboration evidence. | Private |

The root deliberately creates no shared dependency tree or unified build pipeline across `HIA/*`; each end installs, tests and releases independently. Cross-end development uses local package links, examples or fixtures from `HIA/core`.

## Original Tool

The refactoring started from the internal single-file tool `HIA_theme_manager.html`: a single-file workbench built around a primary/secondary console, preset theme library, gradient settings, PC/mini-program previews and CSS/JSON token export. This project keeps its design language and capability boundaries while splitting it into components and deriving multiple ends.

## Planning & Milestones

The public side keeps positioning and capability notes only. Planning, cycles (`W-*`/`C-*`), milestones (`M-*`), ADRs, audits and AI-collaboration records live in the private `work-zone/`; public `docs/` never copies internal process materials.

## Development Environment

- [mise](https://mise.jdx.dev/) is recommended for toolchains: the root `.mise.toml` pins Node 22 (LTS) so local and CI match; run `mise install` after cloning.
- On Windows, shells use PowerShell 7 (`C:\Program Files\PowerShell\7\pwsh.exe`); `mise run` tasks (`build-web`/`test-core`/`test-ssrf`…) wrap common flows.
- Each end installs and builds in its own directory; see each end's README.

## Bilingual Code Docs

Since the first line of source, every semantic node follows ROP (reading-oriented programming) with adjacent bilingual doc comments; JS/TS currently uses `@lang zh-CN`, `@lang en` and inline `<lang>`. See `AGENTS.md`.

## Font Policy

Default UI, samples, tests and generated artifacts only use open-source fonts with clear provenance/licenses or generic fallbacks; fonts of unknown provenance are compatibility inputs only — never defaults or bundled assets.

## Build & Release

Each end builds and releases independently.

- **Web (`HIA/web`)**: `npm install && npm run build` (base path adapts when `GITHUB_PAGES=1`); artifacts deploy to GitHub Pages (`.github/workflows/pages.yml` builds all ends and deploys `web/dist` on every `main` push).
- **Electron (`HIA/electron`)**: `npm install && npm run build` compiles; `npm run dist` produces the **portable** `dist/HIA-Theme-Builder-Electron-<ver>-portable.exe` (bundled runtime, double-click to run) and an NSIS **installer** `...-setup.exe`.
- **Tauri (`HIA/tauri`)**: `npm install` (includes `@tauri-apps/cli`) → `npm run build` (`build:front` + `tauri build`); release artifacts are a standalone portable `exe` and an MSI bundle (requires the system WebView2 Runtime).

Desktop artifacts are self-signed (the OS may ask to verify the publisher on first run — choose "Run anyway"). GitHub Releases aggregate the desktop artifacts (Electron portable + installer, Tauri portable + MSI, with SHA-256 checksums); the web edition is served via Pages.

### v0.3.0 Highlights (2026-11-10)

- Bilingual **docs subsite** (getting started / manual / reference) with a language switch, opening in the app's UI language via `?lang=`;
- Pine-themed **site icon set** across the browser tab, desktop window title bars/taskbars and installer assets;
- URL extraction **apply-scope checkboxes** (apply primary & secondary / apply other colors to auxiliary);
- Tauri: no release **console window**, no **leftover Chromium windows** (explicit headless + timeout guards);
- Auxiliary slot cap raised to **12**; top-right GitHub/docs links; site footer; bilingual README.

## Licenses

Mixed licensing:

- Root docs and `HIA/core`, `HIA/web`, `HIA/tauri` are licensed under the **MIT License**.
- `HIA/electron/` is licensed under the **Apache License 2.0** (its URL-extraction extras may pull Apache-2.0 dependencies, and the patent grant suits enterprise distribution better). See the root `LICENSE`; audits live in the private WorkZone.
- `work-zone/` is an independent private repository and is not distributed under the public licensing.

All third-party dependencies, fonts, icons and binary assets entering release paths must record source, version and license; permissive licenses (MIT, Apache-2.0, BSD, ISC, OFL, CC0) are preferred.
