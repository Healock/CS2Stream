# cs2stream TUI Design

## Goal

Add a command named `cs2stream` that opens a terminal menu for the existing Douyu CS2 resolver. The user should not need to remember CLI flags for normal use.

## Scope

The first TUI release remains focused on Douyu CS2 and the default anchor `https://www.douyu.com/601514`.

It will:

- Resolve the current Douyu CS2 event rooms.
- Generate a PotPlayer `.dpl` playlist.
- Optionally launch PotPlayer with the generated playlist.
- Show the event title, playlist path, room count, playable room count, and failed rooms.
- Allow temporary changes to the anchor and output directory during the session.
- Allow setting a PotPlayer executable path during the session.
- Preserve visible placeholders for account authentication and future Huya/Bilibili support.

It will not claim to create or manage internal PotPlayer playlist folders. The stable handoff is opening the generated `.dpl` with PotPlayer.

## User Flow

Running `cs2stream` opens a menu:

```text
CS2 Stream Assistant

Anchor: https://www.douyu.com/601514
Output: out
PotPlayer: auto

1. Resolve Douyu CS2 and open in PotPlayer
2. Resolve Douyu CS2 and only generate playlist
3. Show last result
4. Set PotPlayer path
5. Set Douyu anchor
6. Set output directory
7. Account authentication settings
8. Other platform settings
0. Exit
```

The recommended path is option 1. It runs the resolver, writes the playlist, locates PotPlayer, and opens the playlist when possible. If PotPlayer is not found, it reports the playlist path and asks the user to set the executable path.

## PotPlayer Launch Strategy

The launcher will try paths in this order:

1. A user-provided PotPlayer path from the TUI session.
2. Common Windows install paths:
   - `C:\Program Files\DAUM\PotPlayer\PotPlayerMini64.exe`
   - `C:\Program Files\DAUM\PotPlayer\PotPlayerMini.exe`
   - `C:\Program Files (x86)\DAUM\PotPlayer\PotPlayerMini.exe`
3. Windows file association fallback by opening the playlist path.

The initial behavior will open the generated `.dpl` as a playlist. It will not default to `/add` or `/insert` because those modes depend on the user's current PotPlayer instance and settings.

## Architecture

The implementation will add small modules around the existing resolver:

- `src/tui.ts`: executable TUI entrypoint and menu loop.
- `src/tui/menu.ts`: pure menu rendering and input routing helpers.
- `src/potplayer.ts`: PotPlayer path detection and launch helper.
- Existing `runResolver()` remains the only stream resolution path.

`package.json` will expose:

```json
"bin": {
  "cs2stream": "./dist/tui.js",
  "douyu-cs2-potplayer": "./dist/cli.js"
}
```

After `npm run build` and `npm link`, `cs2stream` should be available from PowerShell or CMD.

## Error Handling

Resolver failures will be shown as readable menu output while preserving their structured error codes internally.

PotPlayer launch failures will not discard the playlist. The TUI will show the playlist path and suggest setting the PotPlayer path.

Placeholder menu items for account authentication and other platforms will explicitly say they are reserved for a later version.

## Testing

Tests will cover:

- Menu action routing from numeric input.
- Formatting of success and failure result summaries.
- PotPlayer path detection using injected filesystem checks.
- PotPlayer launch command construction using an injected process runner.
- `package.json` exposes the `cs2stream` binary.

Manual verification will include:

- `npm test`
- `npm run build`
- `npm link`
- `cs2stream` opens the TUI from a new shell

