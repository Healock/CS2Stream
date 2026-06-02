# Douyu CS2 PotPlayer Plugin

Resolve Douyu CS2 event rooms for PotPlayer through a Node helper that emits a playlist.

## Scope

The current default anchor is `https://www.douyu.com/601514`.

This first implementation supports Douyu only. Authentication support and additional live platforms such as Huya and Bilibili are future extension points.

## Development

Run commands from the repository root in Windows PowerShell:

```powershell
npm install
npm test
npm run build
node dist/cli.js --anchor https://www.douyu.com/601514 --output-dir out
```

The CLI prints structured JSON. On success, the JSON includes `playlistPath`, which points to the generated playlist.

If PotPlayer does not display DPL `playname` values as folder-like labels, run the CLI with `--prefix-titles`:

```powershell
node dist/cli.js --anchor https://www.douyu.com/601514 --output-dir out --prefix-titles
```

## PotPlayer Entry

The PotPlayer AngelScript entry is in `potplayer/MediaPlayParse - Douyu CS2.as`.

Install it under the matching PotPlayer extension directory only after verifying the local PotPlayer script execution API on the target machine. The current AngelScript file documents the Media PlayParse entry path while Douyu extraction remains owned by the Node resolver.
