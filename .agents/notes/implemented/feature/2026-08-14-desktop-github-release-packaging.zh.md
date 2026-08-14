# Agent Note: Desktop GitHub Release packaging

Status: implemented

[English](2026-08-14-desktop-github-release-packaging.md) | 中文

## Problem

桌面 Electron 壳可以在本地构建，但本 fork 没有能在 macOS／Windows 产出安装包并挂到 Release 的 GitHub Actions 路径。贡献者否则只能手工在这两个操作系统上运行 `electron-builder`。

## Decision

[`.github/workflows/desktop-release.yml`](../../../../.github/workflows/desktop-release.yml) 在版本 tag 推送（`[0-9]*`）、`release: published` 与 `workflow_dispatch` 时运行。矩阵使用 `macos-latest` 与 `windows-latest`：安装工作区、构建 harness、运行 [`apps/desktop/scripts/prepare-resources.mjs`](../../../../apps/desktop/scripts/prepare-resources.mjs)（以 legacy `pnpm deploy` 部署 `@deepseek-ai/dsh`，并将固定的 Node 24 二进制放入 `apps/desktop/.pack/runtime/`），再对该 OS 执行 `electron-builder`。deploy 树必须嵌套在 `runtime/` 下，因为 electron-builder 的 `createFilter` 会丢掉相对 `extraResources.from` 的顶层 `node_modules`；否则安装后启动会因 `Cannot find package '@deepseek-ai/dsh-app-boot'` 闪退。deploy 之后脚本物化指向仓库外的 vendor 符号链接（如 cosmokit），再把缺失的 `@deepseek-ai/*` 提升到顶层 `node_modules`：优先链接 `.pnpm` 自有目录（保留 `zod` 等同级依赖），并对 deploy 未收录的 peer 包（如 `dsh-timeout`）从 monorepo 源码拷贝。prepare 会要求打包态 `dsh --help` 与短暂的 `dsh web --port 0` 冒烟打出就绪 URL，否则失败。产物先从被 `.gitignore` 忽略的 `apps/desktop/release/` 拷到可上传目录（`upload-artifact` 会遵循 `.gitignore`），再经 `actions/upload-artifact` 上传；在 tag 或 Release 事件下再由 `softprops/action-gh-release` 挂到该 Release。

打包后的启动从 `process.resourcesPath` 解析 Node 与 `dsh`（[`runtime-paths.ts`](../../../../apps/desktop/src/runtime-paths.ts)）；开发态仍使用工作区依赖与系统 Node。打包态 cwd 默认为用户主目录（Finder 启动时常为 `/`）。启动失败会先弹出错误对话框再退出。macOS 签名有意关闭（`CSC_IDENTITY_AUTO_DISCOVERY=false`，`mac.identity: null`）。macOS 图标使用已提交的 `build/icon.icns`，打包时不必再下载 electron-builder 的 icons bundle。

## Verification

- 单元测试覆盖打包态与开发态路径解析（`apps/desktop/tests/runtime-paths.spec.ts`）。
- 推送版本 tag 或发布 GitHub Release（或手动运行 **Desktop Release**）必须在 `apps/desktop/release/` 下产出各 OS 产物，并在 tag／Release 事件中挂到该 Release。

## Alternatives considered

**仅用 electron-builder `--publish always`。** 拒绝作为唯一上传路径：矩阵任务争用同一 Release API 比带显式 glob 的 `softprops/action-gh-release` 更别扭，且本地 `dist` 必须保持不发布（CI 使用 `--publish never`）。

**只交付 Electron 壳，要求系统 Node 与 PATH 上的 `dsh`。** 拒绝用于 Release 资源：GitHub 安装包的终端用户应得到捆绑的 Node 与已 deploy 的 CLI 树，而不是再装一套工具链。

**在同一变更中为 macOS 签名。** 拒绝，直到本 fork 具备 Apple 证书与公证密钥；未签名构建已在包 README 中说明。

## Consequences

创建版本 tag（或 Release）是发布桌面安装包的支持方式。`workflow_dispatch` 支持无 tag 的预演。安装包体积跟随完整的 `dsh` 生产 deploy。签名与自动更新仍属后续工作。未配置 `DEEPSEEK_API_KEY_EXTERNAL` 时跳过真实 API e2e，避免本 fork 的 push CI 假红。`pnpm-workspace.yaml` 将 `@electron/get` 覆盖为 4.0.2，因为 electron-builder 26.15.x 会读取 `ElectronDownloadCacheMode`，但其声明仍为 `^3`。
