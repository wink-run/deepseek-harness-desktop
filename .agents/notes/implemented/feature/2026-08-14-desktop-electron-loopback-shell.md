# Agent Note: Desktop Electron shell over loopback `dsh web`

Status: implemented

English | [中文](2026-08-14-desktop-electron-loopback-shell.zh.md)

## Problem

Operators want a native-window desktop product for the same browser UI that `dsh web` serves. The GUI layering design reserves an Electron IPC fetch carrier and `file://` static loading that does not reuse `dsh-host-webserver`, but that carrier is not built. Shipping nothing until IPC lands leaves the product without a desktop entry.

## Decision

`apps/desktop` (`@deepseek-ai/dsh-desktop`) is an Electron main-process shell that:

1. Spawns system Node running `dsh web --port 0` (never Electron's `process.execPath`, so Node-native addons keep their ABI).
2. Treats the `dsh web: http://127.0.0.1:<port>` readiness line from `@deepseek-ai/dsh-web-app` as the signal to open a `BrowserWindow` at that origin.
3. Kills the child on quit.

The shell reuses the shipped Web composition unchanged: webserver, `/api` trust fence, plugin roster, and frontend dist. Root scripts `pnpm run desktop`, `desktop:pack`, and `desktop:dist` build and launch or package it. The `dsh-desktop` bin resolves the local `electron` binary and loads `lib/main.js`.

This is an intentional interim carrier. The [GUI layering note](../architecture/2026-07-19-gui-layering-and-rpc-protocol.md) still owns the eventual IPC/`file://` design; this note owns the loopback-wrapper product that ships today.

## Verification

- Unit tests pin readiness-line parsing (`apps/desktop/tests/ready-url.spec.ts`).
- Source launch: `pnpm run build && pnpm run desktop` opens the window against a live nested `dsh web`.

## Alternatives considered

**Ship the IPC fetch carrier and `file://` dist loading first.** Rejected for this change: it requires a new AbstractApiClient transport, downlink replacement for the WebSocket carrier, boot-manifest injection without the HTTP modules plugin path, and full GUI regression. The loopback wrapper delivers a desktop window without that transport rewrite.

**Run `dsh` under `ELECTRON_RUN_AS_NODE`.** Rejected because harness native addons are compiled for the workspace Node ABI and do not load in Electron's Node.

**Browser PWA install only (`manifest.webmanifest`).** Rejected as the sole answer: install metadata already exists for supporting browsers, but it is not a native desktop package with an Electron window and installer targets.

**Fold the shell into `@deepseek-ai/dsh` as `dsh desktop`.** Rejected for this change so the published CLI does not gain an Electron dependency; the desktop package stays a sibling app under `apps/`.

## Consequences

Contributors get a one-command desktop window over the real Web stack. Packaged installers still need a system Node on `PATH` until a portable Node is embedded. A later IPC carrier can replace this shell's transport without changing the React client packages; when that lands, this note's loopback decision is superseded and should be archived or consolidated into the layering note.
