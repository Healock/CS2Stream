# CS2Stream

[English](./README.md) | [简体中文](./README.zh-CN.md)

CS2Stream 是一个面向 Windows 的命令行工具，用于解析 CS2 赛事直播流，并生成 PotPlayer 可播放的播放列表。

它目前主要面向斗鱼、虎牙和 Bilibili 的 CS2 赛事直播。主界面是交互式 TUI，也提供 JSON CLI 方便脚本调用和调试。

> 本项目不是官方工具，并且依赖直播平台公开网页行为。平台改版可能导致直播间发现或播放地址解析失效。

## 功能

- 同时解析多个平台配置好的 CS2 赛事入口。
- 生成 PotPlayer `.dpl` 播放列表。
- 在检测到 PotPlayer 时自动打开生成的播放列表。
- 支持方向键操作的交互式 TUI。
- 支持中文和英文界面。
- 支持按平台配置入口地址。
- 支持纯净流过滤，默认保留标题包含 `纯净流` 的房间。
- 支持通过浏览器捕获 Cookie，用于需要登录状态的平台请求。
- 提供 CLI 模式，便于自动化和诊断。

## 支持的平台

默认入口：

| 平台 | 默认入口 |
| --- | --- |
| 斗鱼 | `https://www.douyu.com/601514` |
| 虎牙 | `https://www.huya.com/eslcs`, `https://www.huya.com/eslcsgo2`, `https://www.huya.com/825801`, `https://www.huya.com/825802` |
| Bilibili | `https://live.bilibili.com/35` |

说明：

- 斗鱼和虎牙会尽量解析为 PotPlayer 可直接播放的直播流。
- Bilibili 已实现直播间发现，但对直接播放保持保守。需要不稳定请求头或账号状态的流会报告为 `auth_required`。
- 虎牙官方赛事直播间标题不一定包含 `纯净流`，因此默认纯净流策略会允许已知的虎牙官方 CS2 赛事入口。

## 环境要求

- Windows
- PowerShell 5.1 或更新版本
- PotPlayer
- Node.js `20.18.1` 或更新版本
- Chrome 或 Edge，用于浏览器兜底和 Cookie 捕获

一键安装脚本会自动检查 Node.js。如果 Node.js 缺失或版本过旧，它会依次尝试 winget、Chocolatey、Scoop，以及用户本地 portable Node.js；全部失败后才会提示手动安装。

## 安装

在 PowerShell 中运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -c "irm https://cdn.healock.cc/cs2stream/install.ps1 | iex"
```

安装后启动 TUI：

```powershell
cs2stream
```

如果想先查看安装脚本再执行：

```powershell
irm https://cdn.healock.cc/cs2stream/install.ps1 -OutFile install.ps1
notepad .\install.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

## 卸载

移除全局 CS2Stream 命令：

```powershell
npm uninstall -g cs2stream
```

如果安装脚本因为 Node.js 缺失或版本过旧创建了用户本地 portable Node.js，也可以删除辅助目录：

```powershell
Remove-Item "$env:LOCALAPPDATA\CS2Stream" -Recurse -Force
```

大多数用户只需要执行 npm 卸载命令。

## 使用

启动 TUI：

```powershell
cs2stream
```

菜单中提供常用操作：

- 解析已启用的 CS2 平台入口并用 PotPlayer 打开播放列表。
- 只生成播放列表，不打开 PotPlayer。
- 查看上一次解析结果。
- 配置 PotPlayer 路径。
- 配置启用的平台和入口 URL。
- 为需要登录状态的请求捕获浏览器 Cookie。
- 在中文和英文之间切换界面语言。

生成的播放列表会写入配置的输出目录，默认是 `out`。

## CLI

原始 CLI 会输出结构化 JSON：

```powershell
cs2stream-cli --output-dir out
```

覆盖默认入口：

```powershell
cs2stream-cli --anchor https://www.huya.com/825801 --anchor https://live.bilibili.com/35 --output-dir out
```

包含标题不含 `纯净流` 的房间：

```powershell
cs2stream-cli --all-rooms
```

如果 PotPlayer 没有清楚显示 DPL 的 `playname`，可以给条目标题加前缀：

```powershell
cs2stream-cli --prefix-titles
```

## 账号认证

部分直播流可能需要账号 Cookie。在 TUI 中打开：

```text
设置 -> 账号认证设置
```

CS2Stream 会打开真实浏览器登录页，等待你登录，然后捕获所选平台的 Cookie，并且只把这些 Cookie 传给对应平台的解析请求。

Windows 下浏览器查找顺序：

1. `CS2STREAM_BROWSER_PATH`
2. 已安装的 Chrome 或 Edge
3. Playwright 的内置浏览器

也可以手动指定浏览器路径：

```powershell
$env:CS2STREAM_BROWSER_PATH = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
cs2stream
```

## 开发

安装依赖：

```powershell
npm install
```

构建：

```powershell
npm run build
```

运行测试：

```powershell
npm test
```

将本地命令链接到系统：

```powershell
npm link
cs2stream
```

创建发布 tarball：

```powershell
npm run build
npm pack
```

## PotPlayer 脚本入口

PotPlayer AngelScript 元数据占位文件位于：

```text
potplayer/MediaPlayParse - Douyu CS2.as
```

当前可用入口是 Node CLI/TUI。直播流解析由 Node resolver 负责，PotPlayer 脚本目前保留为未来集成点。

## 故障排查

### 安装后找不到 `cs2stream`

重新打开一个 PowerShell 窗口再试。如果仍然失败，确认 npm 全局 prefix 已加入 `PATH`。

### PowerShell 阻止 npm 的 `.ps1` shim

安装脚本会删除 CS2Stream 生成的 `.ps1` shim，让 PowerShell 解析到 `cs2stream.cmd` 和 `cs2stream-cli.cmd`。

### 浏览器登录失败

安装 Chrome 或 Edge，或者设置 `CS2STREAM_BROWSER_PATH`。如果需要 Playwright 浏览器运行时，可以执行：

```powershell
npx playwright install chromium
```

### 没有找到纯净流房间

默认过滤器保留标题包含 `纯净流` 的房间。可以在 TUI 中把纯净流策略改为全部房间，或者使用：

```powershell
cs2stream-cli --all-rooms
```

## 隐私

捕获的 Cookie 只会在本机用于解析请求。不要分享包含账号 Cookie 的日志、截图或文件。

## 免责声明

CS2Stream 与斗鱼、虎牙、Bilibili、PotPlayer 或任何赛事主办方均无关联。请负责任地使用，并遵守访问平台的相关条款。
