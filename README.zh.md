# DeepSeek Harness Desktop

[English](README.md) | 中文

本仓库是官方 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）的**桌面版**：在保留上游「一切皆插件」的 agent harness 基础上，增加 Electron 壳（`apps/desktop`），用原生窗口打开同一套 Web UI。

DeepSeek Harness 是由 [DeepSeek AI](https://deepseek.com) 开发的开源 agent harness（智能体框架）。它采用**一切皆插件**的架构，并由 [Cordis](https://github.com/cordiverse/cordis) 驱动，其设计参见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper)。

上游权威仓库：[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)。

## 开发者预览

DeepSeek Harness 目前处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

## 运行

### 从源码运行

本仓库检出即为桌面版。克隆并构建后，打开 Electron 窗口：

```sh
git clone https://github.com/wink-run/deepseek-harness-desktop.git
cd deepseek-harness-desktop
pnpm install
pnpm run build
pnpm run desktop
```

桌面壳会在回环地址上启动嵌套的 `dsh web`，并打开原生窗口。详见 [`apps/desktop/README.md`](apps/desktop/README.md)。

本仓库的 GitHub Releases 会在推送版本 tag（如 `0.1.0`）或发布 Release 时，通过 [Desktop Release](.github/workflows/desktop-release.yml) 构建并挂载 macOS／Windows 安装包。

若只需浏览器 UI：

```sh
pnpm dsh web
```

Web UI 默认地址为 `http://127.0.0.1:3080`。详见 [Web UI 指南](docs/user/guide/index.md)。

### 通过 `npm` 运行

安装 `Node.js` 后，可不检出本仓库，直接运行官方包：

```sh
npx @deepseek-ai/dsh web
```

## 社区与支持

- 上游反馈：[GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions)。
- 为你的插件仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题，便于被发现。
- 欢迎加入 DeepSeek Harness 企微群：扫码添加企微小助手并填写入群问卷，完成后小助手会邀请你入群。

<table>
  <thead>
    <tr>
      <th align="center">企微小助手</th>
      <th align="center">入群问卷</th>
      <th align="center">微信公众号</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="assets/community-wecom-assistant.png" alt="DeepSeek Harness 企微小助手二维码" width="180" height="180"></td>
      <td align="center"><a href="https://trtgsjkv6r.feishu.cn/share/base/form/shrcnIt5twSVdLGD52KJBckGCgg"><img src="assets/community-wecom-survey.png" alt="DeepSeek Harness 入群问卷二维码" width="180" height="180"></a></td>
      <td align="center"><img src="assets/community-wechat-official-account.png" alt="DeepSeek Harness 团队微信公众号二维码" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 开发

请先阅读[开发指南](docs/development.md)与[架构文档](docs/architecture.md)。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
