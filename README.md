# CS2Stream

[English](./README.md) | [简体中文](./README.zh-CN.md)

CS2Stream is a Windows command-line helper for resolving CS2 event live streams and generating PotPlayer-compatible playlists.

It currently targets CS2 event coverage on Douyu, Huya, and Bilibili. The main interface is an interactive TUI, while a JSON CLI is also available for scripting and debugging.

> This project is unofficial and depends on public web behavior from live-streaming platforms. Platform changes may break stream discovery or playback.

## Features

- Resolve configured CS2 event entries from multiple platforms together.
- Generate PotPlayer `.dpl` playlists.
- Open generated playlists in PotPlayer when PotPlayer can be detected.
- Interactive TUI with arrow-key navigation.
- Chinese and English interface language support.
- Per-platform entry configuration.
- Clean-stream filtering, defaulting to rooms whose labels contain `纯净流`.
- Browser-based cookie capture for account-gated platform requests.
- Direct CLI mode for automation and diagnostics.

## Supported Platforms

Default entries:

| Platform | Default entry |
| --- | --- |
| Douyu | `https://www.douyu.com/601514` |
| Huya | `https://www.huya.com/eslcs`, `https://www.huya.com/eslcsgo2`, `https://www.huya.com/825801`, `https://www.huya.com/825802` |
| Bilibili | `https://live.bilibili.com/35` |

Notes:

- Douyu and Huya streams are resolved for direct PotPlayer playback when possible.
- Bilibili discovery is implemented, but direct playback is conservative. Streams that require unstable request headers or account state may be reported as `auth_required`.
- Huya official event rooms may not always include `纯净流` in the room title, so known official CS2 event entries are allowed by the default clean-stream policy.

## Requirements

- Windows
- PowerShell 5.1 or newer
- PotPlayer
- Node.js `20.18.1` or newer
- Chrome or Edge for browser-backed fallback and cookie capture

The one-line installer checks Node.js automatically. If Node.js is missing or too old, it tries winget, Chocolatey, Scoop, and finally a user-local portable Node.js before asking for manual installation.

## Installation

Run this in PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -c "irm https://cdn.healock.cc/cs2stream/install.ps1 | iex"
```

Then start the TUI:

```powershell
cs2stream
```

For a review-before-run install:

```powershell
irm https://cdn.healock.cc/cs2stream/install.ps1 -OutFile install.ps1
notepad .\install.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

## Uninstall

Remove the global CS2Stream command:

```powershell
npm uninstall -g cs2stream
```

If the installer created a user-local portable Node.js because Node.js was missing or too old, remove the helper directory as well:

```powershell
Remove-Item "$env:LOCALAPPDATA\CS2Stream" -Recurse -Force
```

Most users only need the npm uninstall command.

## Usage

Start the TUI:

```powershell
cs2stream
```

Common actions are available from the menu:

- Resolve enabled CS2 platform entries and open the playlist in PotPlayer.
- Generate the playlist without opening PotPlayer.
- Show the last resolver result.
- Configure PotPlayer path.
- Configure enabled platforms and entry URLs.
- Capture browser cookies for account-gated requests.
- Switch language between Chinese and English.

The generated playlist is written to the configured output directory, which defaults to `out`.

## CLI

The raw CLI prints structured JSON:

```powershell
cs2stream-cli --output-dir out
```

Override the default entries:

```powershell
cs2stream-cli --anchor https://www.huya.com/825801 --anchor https://live.bilibili.com/35 --output-dir out
```

Include rooms even when their labels do not contain `纯净流`:

```powershell
cs2stream-cli --all-rooms
```

Prefix playlist item titles when PotPlayer does not display DPL `playname` values clearly:

```powershell
cs2stream-cli --prefix-titles
```

## Account Authentication

Some streams may require account cookies. In the TUI, open:

```text
Settings -> Account authentication settings
```

CS2Stream opens a real browser login page, waits for login, captures cookies for the selected platform, and passes those cookies only to that platform's resolver requests.

Browser launch order on Windows:

1. `CS2STREAM_BROWSER_PATH`
2. Installed Chrome or Edge
3. Playwright's bundled browser

Set a browser path manually:

```powershell
$env:CS2STREAM_BROWSER_PATH = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
cs2stream
```

## Development

Install dependencies:

```powershell
npm install
```

Build:

```powershell
npm run build
```

Run tests:

```powershell
npm test
```

Link local commands for development:

```powershell
npm link
cs2stream
```

Create a release tarball:

```powershell
npm run build
npm pack
```

## PotPlayer Script Entry

The PotPlayer AngelScript metadata stub is located at:

```text
potplayer/MediaPlayParse - Douyu CS2.as
```

The Node CLI/TUI is the current working interface. Stream extraction is owned by the Node resolver, while the PotPlayer script remains a future integration point.

## Troubleshooting

### `cs2stream` is not found after installation

Open a new PowerShell window and try again. If it still fails, ensure the npm global prefix is on `PATH`.

### PowerShell blocks npm `.ps1` shims

The installer removes CS2Stream's generated `.ps1` shims so PowerShell resolves `cs2stream.cmd` and `cs2stream-cli.cmd`.

### Browser login fails

Install Chrome or Edge, or set `CS2STREAM_BROWSER_PATH`. If Playwright is needed, install its browser runtime:

```powershell
npx playwright install chromium
```

### No clean stream rooms are found

The default filter keeps rooms whose labels contain `纯净流`. Change the TUI clean-stream setting to all rooms, or use:

```powershell
cs2stream-cli --all-rooms
```

## Privacy

Captured cookies are used locally for resolver requests. Do not share logs, screenshots, or files containing account cookies.

## Disclaimer

CS2Stream is not affiliated with Douyu, Huya, Bilibili, PotPlayer, or any tournament organizer. Use it responsibly and follow the terms of the platforms you access.
