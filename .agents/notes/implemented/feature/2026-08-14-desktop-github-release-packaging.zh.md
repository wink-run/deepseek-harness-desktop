# Agent Note: Desktop GitHub Release packaging

Status: implemented

[English](2026-08-14-desktop-github-release-packaging.md) | 中文

## Problem

桌面 Electron 壳可以在本地构建，但本 fork 没有能在 macOS／Windows 产出安装包并挂到 Release 的 GitHub Actions 路径。贡献者否则只能手工在这两个操作系统上运行 `electron-builder`。

## Decision

[`.github/workflows/desktop-release.yml`](../../../../.github/workflows/desktop-release.yml) 在版本 tag 推送（`[0-9]*`）、`release: published` 与 `workflow_dispatch` 时运行。矩阵使用 `macos-latest` 与 `windows-latest`：安装工作区、构建 harness、运行 [`apps/desktop/scripts/prepare-resources.mjs`](../../../../apps/desktop/scripts/prepare-resources.mjs)（以 legacy `pnpm deploy` 部署 `@deepseek-ai/dsh`，并将固定的 Node 24 二进制放入 `apps/desktop/.pack/`），再对该 OS 执行 `electron-builder`。产物经 `actions/upload-artifact` 上传；在 tag 或 Release 事件下再由 `softprops/action-gh-release` 挂到该 Release。

打包后的启动从 `process.resourcesPath` 解析 Node 与 `dsh`（[`runtime-paths.ts`](../../../../apps/desktop/src/runtime-paths.ts)）；开发态仍使用工作区依赖与系统 Node。macOS 签名有意关闭（`CSC_IDENTITY_AUTO_DISCOVERY=false`，`mac.identity: null`）。

## Verification

- 单元测试覆盖打包态与开发态路径解析（`apps/desktop/tests/runtime-paths.spec.ts`）。
- 推送版本 tag 或发布 GitHub Release（或手动运行 **Desktop Release**）必须在 `apps/desktop/release/` 下产出各 OS 产物，并在 tag／Release 事件中挂到该 Release。

## Alternatives considered

**仅用 electron-builder `--publish always`。** 拒绝作为唯一上传路径：矩阵任务争用同一 Release API 比带显式 glob 的 `softprops/action-gh-release` 更别扭，且本地 `dist` 必须保持不发布（CI 使用 `--publish never`）。

**只交付 Electron 壳，要求系统 Node 与 PATH 上的 `dsh`。** 拒绝用于 Release 资源：GitHub 安装包的终端用户应得到捆绑的 Node 与已 deploy 的 CLI 树，而不是再装一套工具链。

**在同一变更中为 macOS 签名。** 拒绝，直到本 fork 具备 Apple 证书与公证密钥；未签名构建已在包 README 中说明。

## Consequences

创建版本 tag（或 Release）是发布桌面安装包的支持方式。`workflow_dispatch` 支持无 tag 的预演。安装包体积跟随完整的 `dsh` 生产 deploy。签名与自动更新仍属后续工作。未配置 `DEEPSEEK_API_KEY_EXTERNAL` 时跳过真实 API e2e，避免本 fork 的 push CI 假红。`pnpm-workspace.yaml` 将 `@electron/get` 覆盖为 4.0.2，因为 electron-builder 26.15.x 会读取 `ElectronDownloadCacheMode`，但其声明仍为 `^3`。
