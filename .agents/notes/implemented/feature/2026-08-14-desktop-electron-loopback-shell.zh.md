# Agent Note: Desktop Electron shell over loopback `dsh web`

Status: implemented

[English](2026-08-14-desktop-electron-loopback-shell.md) | 中文

## Problem

操作者希望为与 `dsh web` 相同的浏览器 UI 提供原生窗口桌面产品。GUI 分层设计为 Electron 预留了 IPC fetch 载体与不复用 `dsh-host-webserver` 的 `file://` 静态加载，但该载体尚未实现。若等到 IPC 落地才交付，产品将缺少桌面入口。

## Decision

`apps/desktop`（`@deepseek-ai/dsh-desktop`）是一个 Electron 主进程壳，它：

1. 用系统 Node 启动 `dsh web --port 0`（从不使用 Electron 的 `process.execPath`，以保持 Node 原生插件的 ABI）。
2. 将 `@deepseek-ai/dsh-web-app` 打印的 `dsh web: http://127.0.0.1:<port>` 就绪行作为打开指向该源的 `BrowserWindow` 的信号。
3. 在退出时杀死子进程。

该壳原样复用已交付的 Web 组合：webserver、`/api` 信任栅栏、插件名录与前端 dist。根脚本 `pnpm run desktop`、`desktop:pack` 与 `desktop:dist` 负责构建并启动或打包。`dsh-desktop` bin 解析本地 `electron` 二进制并加载 `lib/main.js`。

这是有意的过渡载体。[GUI 分层说明](../architecture/2026-07-19-gui-layering-and-rpc-protocol.md) 仍拥有最终的 IPC／`file://` 设计；本说明拥有今日交付的回环包装产品。

## Verification

- 单元测试钉死就绪行解析（`apps/desktop/tests/ready-url.spec.ts`）。
- 源码启动：`pnpm run build && pnpm run desktop` 会对嵌套的存活 `dsh web` 打开窗口。

## Alternatives considered

**先交付 IPC fetch 载体与 `file://` dist 加载。** 本次变更拒绝：它需要新的 AbstractApiClient 传输、替换 WebSocket 下行载体、在无 HTTP modules 插件路径下注入 boot manifest，以及完整 GUI 回归。回环包装无需改写传输即可交付桌面窗口。

**在 `ELECTRON_RUN_AS_NODE` 下运行 `dsh`。** 拒绝，因为 harness 原生插件按工作区 Node ABI 编译，无法在 Electron 的 Node 中加载。

**仅依赖浏览器 PWA 安装（`manifest.webmanifest`）。** 拒绝作为唯一答案：安装元数据已存在于支持的浏览器中，但它不是带 Electron 窗口与安装器目标的原生桌面包。

**把壳并入 `@deepseek-ai/dsh` 作为 `dsh desktop`。** 本次变更拒绝，以免已发布的 CLI 获得 Electron 依赖；桌面包保持为 `apps/` 下的并列应用。

## Consequences

贡献者可通过一条命令在真实 Web 栈上打开桌面窗口。在嵌入便携 Node 之前，打包安装器仍需要 `PATH` 上的系统 Node。后续 IPC 载体可在不改动 React 客户端包的情况下替换本壳的传输；届时本说明的回环决策被取代，应归档或并入分层说明。
