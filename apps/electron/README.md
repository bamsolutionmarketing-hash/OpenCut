# @opencut/electron

Electron desktop shell for OpenCut. Wraps `@opencut/web` (the Next.js app
that hosts the editor and the new `/cn-to-vi` CN→VI auto-pipeline) in a
native window so you can run it without a browser.

This shell is **additive** — it does not modify any existing OpenCut code.
It can be removed at any time without breaking the web app.

> Note: a separate Rust/GPUI desktop app exists at `apps/desktop/`. That
> one is a from-scratch native rewrite. This Electron shell is the fastest
> path to having the modified web UI (including `/cn-to-vi`) on the desktop.

## Prerequisites

- **Bun ≥ 1.2.18** — this repo is locked to bun via the root `packageManager`
  field. Do **not** use npm or pnpm; npm in particular hits an `ERESOLVE`
  conflict between Next 16.1.3 and `@opennextjs/cloudflare`'s peer range.
- Node 18+ (Electron tooling uses Node under the hood)

Install bun:

```bash
# Linux / macOS / WSL
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"
```

Restart your terminal so PATH picks up bun.

## Use it now (one command)

From the repo root:

```bash
./apps/electron/run.sh
```

That script:

1. Installs `apps/electron` deps if missing
2. Downloads the Electron binary on first run
3. Installs `apps/web` deps if missing
4. Compiles the TS main / preload (`tsc -p tsconfig.json` → `dist/`)
5. Starts `apps/web` in Next dev mode on port 3000
6. Launches an Electron window pointing at `http://localhost:3000/cn-to-vi`

Hot reload works for both Next.js and the renderer.

### Add a desktop launcher (Linux GNOME/KDE/etc.)

```bash
./apps/electron/install-desktop-entry.sh
```

Then "OpenCut" shows up in your application menu and runs `run.sh` for you.

### Windows

```cmd
apps\electron\run.bat
```

### Manual / step-by-step

```bash
cd apps/electron
bun install
bun run dev
```

### Custom port / landing route

```bash
OPENCUT_PORT=4001 OPENCUT_LANDING_PATH=/projects bun run dev
```

## Production build

The packaged app bundles the `apps/web` Next.js build inside the Electron
resources and runs it as a child process at startup.

```bash
# 1. Build the web app (uses Next standalone output; see note below)
cd apps/web
bun run build

# 2. Build & package Electron
cd ../electron
bun install
bun run dist        # → apps/electron/release/<platform installer>
# or
bun run package     # → apps/electron/release/<platform unpacked dir>
```

> **Important — Next standalone output.** For packaging to work, the
> production build must emit `apps/web/.next/standalone`. If your repo's
> `apps/web/next.config.ts` does not yet set `output: "standalone"`,
> either:
>
> - Add `output: "standalone"` to that config (touches OpenCut), **or**
> - Set the env var `NEXT_OUTPUT=standalone` before `bun run build`
>   if the config respects it, **or**
> - Run the dev path only (`bun run dev`) and skip packaging.
>
> The dev path (`bun run dev`) works regardless of standalone output.

## Files

```
apps/electron/
├── package.json              — electron + electron-builder + scripts
├── tsconfig.json
├── start-dev.mjs             — spawns Next dev + Electron, kills both on exit
├── src/
│   ├── main.ts               — Electron main process (window + bundled-server boot)
│   └── preload.ts            — exposes window.opencutDesktop marker
├── dist/                     — tsc output (gitignored)
└── release/                  — electron-builder output (gitignored)
```

## What the renderer sees

In the renderer (any `apps/web` page), you can detect the desktop shell:

```ts
declare global {
  interface Window {
    opencutDesktop?: { platform: string; version: string };
  }
}

if (typeof window !== "undefined" && window.opencutDesktop) {
  console.log("Running inside OpenCut Desktop", window.opencutDesktop);
}
```

The web app is otherwise completely unaware of Electron — same code path
as `bun run dev:web` in a browser.

## Safety

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`
- External links open in the user's default browser (not in the app window)
- Preload exposes only a read-only `opencutDesktop` marker — no IPC, no
  filesystem access from the renderer

## Limitations

- **No auto-update** — wire `electron-updater` later if needed.
- **Production packaging** depends on Next standalone output (see above).
- **Code signing** not configured. `electron-builder` will produce
  unsigned binaries; add platform certs to ship publicly.
- **Mac universal binaries** not configured (single-arch only).
