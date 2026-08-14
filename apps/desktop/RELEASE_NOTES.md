## DeepSeek Harness Desktop

macOS（dmg/zip）与 Windows（nsis）安装包由 Desktop Release 工作流构建并挂到本 Release。

### macOS：提示「已损坏，无法打开」时

当前 macOS 安装包**未签名**。若系统提示文件已损坏或无法打开，在终端执行：

```sh
xattr -cr /Applications/DeepSeekHarnessDesktop.app
```

然后再打开应用。若你把 `.app` 放在其他路径，把上面的路径换成实际位置即可。

### macOS: “damaged and can’t be opened”

macOS builds are **unsigned**. If Gatekeeper reports the app is damaged, run:

```sh
xattr -cr /Applications/DeepSeekHarnessDesktop.app
```

Then open the app again. Adjust the path if you installed the `.app` elsewhere.
