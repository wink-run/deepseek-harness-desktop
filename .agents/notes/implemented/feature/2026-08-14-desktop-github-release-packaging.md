# Agent Note: Desktop GitHub Release packaging

Status: implemented

English | [中文](2026-08-14-desktop-github-release-packaging.zh.md)

## Problem

The desktop Electron shell could be built locally, but this fork had no GitHub Actions path that produced installers and attached them to a Release. Contributors would otherwise hand-run `electron-builder` on three OSes.

## Decision

[`.github/workflows/desktop-release.yml`](../../../../.github/workflows/desktop-release.yml) runs on version tag pushes (`[0-9]*`), `release: published`, and `workflow_dispatch`. A matrix of `macos-latest`, `ubuntu-24.04`, and `windows-latest` installs the workspace, builds the harness, runs [`apps/desktop/scripts/prepare-resources.mjs`](../../../../apps/desktop/scripts/prepare-resources.mjs) (legacy `pnpm deploy` of `@deepseek-ai/dsh` plus a pinned Node 24 binary into `apps/desktop/.pack/`), then `electron-builder` for that OS. Artifacts upload with `actions/upload-artifact` and, on a tag or Release event, attach via `softprops/action-gh-release`.

Packaged launches resolve Node and `dsh` under `process.resourcesPath` ([`runtime-paths.ts`](../../../../apps/desktop/src/runtime-paths.ts)); development still uses the workspace dependency and system Node. macOS signing is deliberately off (`CSC_IDENTITY_AUTO_DISCOVERY=false`, `mac.identity: null`).

## Verification

- Unit tests cover packaged vs development path resolution (`apps/desktop/tests/runtime-paths.spec.ts`).
- Publishing a version tag or GitHub Release (or running **Desktop Release** manually) must produce per-OS artifacts under `apps/desktop/release/` and, for tag/Release events, attach them to the Release.

## Alternatives considered

**electron-builder `--publish always` alone.** Rejected as the sole upload path: matrix jobs race on the same Release API more awkwardly than `softprops/action-gh-release` with explicit globs, and local `dist` must stay publish-free (`--publish never` in CI).

**Ship only the Electron shell and require system Node + `dsh` on PATH.** Rejected for Release assets: end users of a GitHub installer should get a bundled Node and deployed CLI tree rather than a second toolchain install.

**Code-sign macOS in the same change.** Rejected until Apple certificates and notarization secrets exist on this fork; unsigned builds are called out in the package README.

## Consequences

Creating a version tag (or Release) is the supported way to publish desktop installers. Workflow dispatch supports rehearsal without a tag. Installer size follows the full `dsh` production deploy. Signing and auto-update remain future work. Real-API e2e is skipped when `DEEPSEEK_API_KEY_EXTERNAL` is unset so this fork's push CI is not a false red.
