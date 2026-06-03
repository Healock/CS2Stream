# Douyu CS2 PotPlayer Plugin

Resolve Douyu CS2 event rooms for PotPlayer through a Node helper that emits a playlist.

## Scope

The current default anchor is `https://www.douyu.com/601514`.

This first implementation supports Douyu only. Authentication support and additional live platforms such as Huya and Bilibili are future extension points.

## Usage

Run commands from the repository root in Windows PowerShell:

```powershell
npm install
npm run build
npm link
cs2stream
```

`cs2stream` opens a menu. The default option resolves the current Douyu CS2 event from `https://www.douyu.com/601514`, writes a `.dpl` playlist, and opens it in PotPlayer when PotPlayer can be located.

If automatic launch fails, use the playlist path shown in the TUI and open that `.dpl` manually in PotPlayer. You can also set the PotPlayer executable path from the TUI.

The raw CLI remains available:

```powershell
node dist/cli.js --anchor https://www.douyu.com/601514 --output-dir out
```

The CLI prints structured JSON. On success, the JSON includes `playlistPath`, which points to the generated playlist.

If PotPlayer does not display DPL `playname` values as folder-like labels, run the CLI with `--prefix-titles`:

```powershell
node dist/cli.js --anchor https://www.douyu.com/601514 --output-dir out --prefix-titles
```

## Development

Run checks from the repository root:

```powershell
npm test
npm run build
```

## PotPlayer Entry

The PotPlayer AngelScript entry is in `potplayer/MediaPlayParse - Douyu CS2.as`.

The Node CLI is the current working interface. Install the AngelScript file under the matching PotPlayer extension directory only after verifying the local PotPlayer script execution API and playlist handoff on the target machine. The current AngelScript file is a metadata stub that documents the Media PlayParse entry path while Douyu extraction remains owned by the Node resolver.
