# `@deepseek-ai/dsh-desktop`

English | [中文](README.zh.md)

Electron shell for the DeepSeek Harness browser UI. The main process starts `dsh web --port 0` under a system Node binary (development) or a bundled Node plus `pnpm deploy` tree (packaged installers), waits for the readiness URL owned by [`dsh-web-app`](../../packages/bundle/web-app/README.md), and opens a native window at that loopback origin. Closing the window terminates the child. This reuses the shipped Web composition (HTTP carrier, plugin roster, frontend dist) without a separate IPC fetch carrier.

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

`dist` runs [`scripts/prepare-resources.mjs`](scripts/prepare-resources.mjs) (deploys `@deepseek-ai/dsh` and downloads a platform Node into `.pack/`), then `electron-builder`. Artifacts land in `apps/desktop/release/`.

### GitHub Releases

Publishing a GitHub Release on [wink-run/deepseek-harness-desktop](https://github.com/wink-run/deepseek-harness-desktop) runs [`.github/workflows/desktop-release.yml`](../../.github/workflows/desktop-release.yml): it builds macOS (dmg/zip), Linux (AppImage), and Windows (nsis) installers on hosted runners and attaches them to that Release. You can also run the workflow manually via **Actions → Desktop Release**.

## Known Limitations and Deferred Work

- **Loopback HTTP, not `file://` + IPC.** The [GUI layering note](../../.agents/notes/implemented/architecture/2026-07-19-gui-layering-and-rpc-protocol.md) reserves an IPC fetch carrier for Electron; this shell deliberately keeps the existing webserver so the desktop product ships without a second transport. An IPC carrier remains future work.
- **macOS artifacts are unsigned.** The release workflow sets `CSC_IDENTITY_AUTO_DISCOVERY=false`; Gatekeeper may require a right-click open until signing is configured.
- **Installer size tracks the full `dsh` deploy.** Packaged apps embed a production `pnpm deploy` of the CLI plus Node, so native addons match the runner OS rather than Electron's ABI.
