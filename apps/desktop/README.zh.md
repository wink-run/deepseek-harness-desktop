# `@deepseek-ai/dsh-desktop`

[English](README.md) | 中文

DeepSeek Harness 浏览器 UI 的 Electron 壳。主进程用系统 Node 启动 `dsh web --port 0`，等待 [`dsh-web-app`](../../packages/bundle/web-app/README.md) 拥有的就绪 URL，再在该回环源打开原生窗口。关闭窗口即终止子进程。这样复用已交付的 Web 组合（HTTP 载体、插件名录、前端 dist），无需单独的 IPC fetch 载体。

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

产物位于 `apps/desktop/release/`。打包后的应用仍需要系统 `PATH`（或 `npm_node_execpath`）上的 Node，因为 harness 原生插件是按 Node 而非 Electron 内嵌运行时编译的。嵌入便携 Node 二进制属于后续工作。

## Known Limitations and Deferred Work

- **回环 HTTP，而非 `file://` + IPC。** [GUI 分层说明](../../.agents/notes/implemented/architecture/2026-07-19-gui-layering-and-rpc-protocol.md) 为 Electron 预留了 IPC fetch 载体；本壳有意继续使用现有 webserver，以便在不做第二套传输的情况下交付桌面产品。IPC 载体仍属后续工作。
- **需要系统 Node。** Web 子进程从不在 Electron 的 `process.execPath` 下运行，因为 Node 原生插件（SQLite、PTY、沙箱）无法加载到 Electron 的 ABI。
- **安装器资源尚不完整。** `electron-builder` 会把 CLI lib、agent-preset 配置和 web dist 复制为 extra resources，供将来自包含启动使用；当前主进程仍从安装图／工作区解析 `@deepseek-ai/dsh`。
