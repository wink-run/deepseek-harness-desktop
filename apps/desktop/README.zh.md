# `@deepseek-ai/dsh-desktop`

[English](README.md) | 中文

DeepSeek Harness 浏览器 UI 的 Electron 壳。主进程在开发态用系统 Node、在安装包中用捆绑的 Node 与 `pnpm deploy` 树启动 `dsh web --port 0`，等待 [`dsh-web-app`](../../packages/bundle/web-app/README.md) 拥有的就绪 URL，再在该回环源打开原生窗口。关闭窗口即终止子进程。这样复用已交付的 Web 组合（HTTP 载体、插件名录、前端 dist），无需单独的 IPC fetch 载体。

## 从源码运行

```sh
pnpm run build
pnpm run desktop
```

`pnpm run desktop` 会在需要时构建本包并启动 Electron。调用时的工作目录成为嵌套 `dsh web` 进程的默认 workspace 根目录，与直接运行 `dsh web` 一致。需先执行 `pnpm run build`，以便存在 `@deepseek-ai/dsh` 与前端 dist。

## 打包安装器

```sh
pnpm run build
pnpm --filter @deepseek-ai/dsh-desktop run dist
```

`dist` 会运行 [`scripts/prepare-resources.mjs`](scripts/prepare-resources.mjs)（将 `@deepseek-ai/dsh` deploy 到 `.pack/` 并下载平台 Node），再执行 `electron-builder`。产物位于 `apps/desktop/release/`。

### GitHub Releases

在 [wink-run/deepseek-harness-desktop](https://github.com/wink-run/deepseek-harness-desktop) 上推送版本 tag（如 `0.1.0`）或发布 GitHub Release 会触发 [`.github/workflows/desktop-release.yml`](../../.github/workflows/desktop-release.yml)：在托管 runner 上构建 macOS（dmg/zip）与 Windows（nsis）安装包并挂到该 Release。也可在 **Actions → Desktop Release** 手动运行。

## Known Limitations and Deferred Work

- **回环 HTTP，而非 `file://` + IPC。** [GUI 分层说明](../../.agents/notes/implemented/architecture/2026-07-19-gui-layering-and-rpc-protocol.md) 为 Electron 预留了 IPC fetch 载体；本壳有意继续使用现有 webserver，以便在不做第二套传输的情况下交付桌面产品。IPC 载体仍属后续工作。
- **macOS 产物未签名。** Release 工作流设置 `CSC_IDENTITY_AUTO_DISCOVERY=false`。若系统提示应用已损坏，先清除隔离属性再打开：`xattr -cr /Applications/DeepSeekHarnessDesktop.app`（若安装路径不同请改成实际路径）。
- **安装包体积跟随完整 `dsh` deploy。** 打包应用内嵌 CLI 的生产 `pnpm deploy` 与 Node，因此原生插件匹配 runner 操作系统，而非 Electron 的 ABI。
