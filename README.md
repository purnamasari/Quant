# Quant

A desktop terminal for tracking ETFs and stocks — watchlist, holdings-driven news, an earnings calendar, and Webull-style annotated charts.

> **Note:** Fuller documentation (architecture, data sources, user guide) is generated into the [`docs/`](docs/) folder. This README is the quick-start.

---

## What it's built on

| Layer | Tech |
|---|---|
| Desktop shell | **Electron** (Chromium + Node.js — runs as a native Windows app) |
| UI | **React** + **TypeScript**, rendered as HTML/CSS inside the Electron window |
| Charts | **lightweight-charts** (candlesticks, volume, trend lines) |
| Bundler | **esbuild** |
| Data | Yahoo Finance + Google News (free, no API key); bundled sample data offline |

The app has two parts: a **main** process (Node — fetches market data, no browser access) and a **renderer** (the HTML window you see). They talk over a typed bridge.

---

## Quick start

Requires **Node.js 20+**.

```powershell
# 1. Install dependencies (first time only)
cd c:\_sites\Quant
npm install

# 2. Build and run
npm start
```

`npm start` compiles the app, then launches the desktop window.

### If `npm start` is blocked or no window appears (Windows / VS Code terminal)

Some Windows setups block npm's launcher scripts, and VS Code's terminal sets an
environment variable that makes Electron start invisibly. Use PowerShell and launch
Electron directly:

```powershell
cd c:\_sites\Quant
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue   # clear VS Code's variable
npm run build                                                        # compile (skip if unchanged)
& ".\node_modules\electron\dist\electron.exe" .                      # launch the window
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Build, then launch the app |
| `npm run build` | Compile only (main + renderer → `dist/`) |
| `npm run typecheck` | Type-check without building |
| `npm run smoke` | Headless launch that saves a screenshot to `dist/smoke.png` |

---

## Using the app

- **Left** — your watchlist. Search the box to add ETFs or stocks. Live prices update automatically.
- **Center** — news for the top-20 holdings of your ETFs plus your watched stocks. Filter with the chips.
- **Right** — upcoming earnings dates for those same companies.
- **Click any row** — opens a chart popup: candlesticks with auto-detected highs/lows and trend lines, a `1D / 1W / 1M / 6M / 1Y / 5Y / MAX` toggle, and a side panel that loads news tied to each price swing (the chart appears first, news fills in after).

An amber **SAMPLE** chip means that piece of data is offline fallback rather than live.

---

## Disclaimer

Uses free, unofficial data endpoints (Yahoo Finance, Google News RSS) for educational
purposes. Data may be delayed or approximate. **Not investment advice.**
