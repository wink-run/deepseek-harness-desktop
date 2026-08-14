# `@deepseek-ai/dsh-desktop`

English | [中文](README.zh.md)

Electron shell for the DeepSeek Harness browser UI. The main process starts `dsh web --port 0` under a system Node binary, waits for the readiness URL owned by [`dsh-web-app`](../../packages/bundle/web-app/README.md), and opens a native window at that loopback origin. Closing the window terminates the child. This reuses the shipped Web composition (HTTP carrier, plugin roster, frontend dist) without a separate IPC fetch carrier.

## Run from source

```sh
pnpm run build
pnpm run desktop
```

`pnpm run desktop` builds this package when needed and launches Electron. The invoking directory is the default workspace root for the nested `dsh web` process, matching `dsh web` itself. Requires a prior `pnpm run build` so `@deepseek-ai/dsh` and the frontend dist exist.

## Package installers

```sh
pnpm run build
pnpm --filter @deepseek-ai/dsh-desktop run dist
```

Artifacts land in `apps/desktop/release/`. The packaged app still needs a system Node binary on `PATH` (or `npm_node_execpath`) because harness native addons are compiled for Node, not Electron's embedded runtime. Embedding a portable Node binary is deferred.

## Known Limitations and Deferred Work

- **Loopback HTTP, not `file://` + IPC.** The [GUI layering note](../../.agents/notes/implemented/architecture/2026-07-19-gui-layering-and-rpc-protocol.md) reserves an IPC fetch carrier for Electron; this shell deliberately keeps the existing webserver so the desktop product ships without a second transport. An IPC carrier remains future work.
- **System Node required.** The web child never runs under Electron's `process.execPath`, because Node-native addons (SQLite, PTY, sandboxes) do not load against Electron's ABI.
- **Installer resources are partial.** `electron-builder` copies the CLI lib, agent-preset config, and web dist as extra resources for future self-contained boots; the current main process still resolves `@deepseek-ai/dsh` from the install graph / workspace.
