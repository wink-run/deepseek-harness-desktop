# DeepSeek Harness Desktop

English | [中文](README.zh.md)

This repository is the **desktop edition** of the official [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`). It keeps the upstream plugin-based agent harness and adds an Electron shell (`apps/desktop`) that opens the same Web UI in a native window.

DeepSeek Harness is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com). It uses an architecture where **everything is a plugin**, and is powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper).

Upstream source of truth: [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness).

## Developer preview

DeepSeek Harness is currently in _developer preview_ and is iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

## Run

### Run from source

This checkout is the desktop edition. Clone, build, then open the Electron window:

```sh
git clone https://github.com/wink-run/deepseek-harness-desktop.git
cd deepseek-harness-desktop
pnpm install
pnpm run build
pnpm run desktop
```

The desktop shell starts nested `dsh web` on loopback and opens a native window. See [`apps/desktop/README.md`](apps/desktop/README.md).

GitHub Releases on this repository build and attach macOS / Windows installers via [Desktop Release](.github/workflows/desktop-release.yml) when you push a version tag (e.g. `0.1.0`) or publish a Release.

For the browser UI only:

```sh
pnpm dsh web
```

The Web UI is served at `http://127.0.0.1:3080` by default. See [Web UI guide](docs/user/guide/index.md).

### Run from `npm`

Install `Node.js`, then run the official package without this checkout:

```sh
npx @deepseek-ai/dsh web
```

## Community and support

- Upstream feedback: [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/Ycq5dCaS4">DeepSeek Harness Discord community</a>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
