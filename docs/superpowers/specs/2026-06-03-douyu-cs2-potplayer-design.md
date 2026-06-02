# Douyu CS2 PotPlayer Plugin Design

## Goal

Build a PotPlayer-oriented plugin package for Douyu CS2 events. The package discovers the rooms shown in the current Douyu CS2 event switch-room area, resolves each room to a real playable live stream URL, and hands a grouped playlist to PotPlayer.

The default event anchor is Douyu room `601514`, currently used by `斗鱼CSGO赛事主频道`. The plugin targets CS2 only.

## User-Facing Behavior

1. The user installs the PotPlayer AngelScript extension and the Node resolver helper.
2. The user opens the plugin entry from PotPlayer.
3. The resolver uses `https://www.douyu.com/601514` as the default anchor unless configuration overrides it.
4. The resolver reads the event title from the anchor room page title. The event title is the text before the first underscore in the HTML `<title>`, for example `科隆MAJOR`.
5. The resolver finds the event switch-room area, identified by `wm-pc-switchroom`.
6. The resolver extracts every displayed Douyu room link from that area, regardless of count.
7. The resolver resolves each extracted room to a real live stream URL.
8. The resolver creates a PotPlayer-loadable playlist named after the event, with items labeled by the switch-room button text such as `玩机器`, `QUQU`, `主舞台纯净流`, and `副舞台纯净流`.
9. PotPlayer loads the generated playlist or receives the resolved entries through the extension surface.

## Architecture

### PotPlayer Extension

The PotPlayer side stays thin. It should not own Douyu parsing logic.

Responsibilities:

- Expose the plugin entry inside PotPlayer.
- Invoke the Node resolver.
- Load the generated playlist path or return the resolver's output in the format PotPlayer expects.
- Surface resolver errors in a readable way.

Non-goals:

- Do not implement Douyu signing or complex HTML parsing in AngelScript.
- Do not depend on a direct PotPlayer API for creating GUI playlist folders, because public documentation does not confirm a stable AngelScript API for that.

### Node Resolver

The Node resolver is the main engine.

Responsibilities:

- Fetch or render the anchor page.
- Extract the event title.
- Extract all rooms from `wm-pc-switchroom`.
- Resolve real live stream URLs for every room.
- Write a playlist and diagnostic log.
- Return a machine-readable result to the PotPlayer extension.

Recommended modules:

- `config`: anchor URL, output paths, quality preference, timeout, fallback options.
- `douyu-page`: fetch page HTML and optionally render it with Playwright.
- `switchroom-parser`: parse `wm-pc-switchroom` and extract `{ roomId, roomUrl, label }`.
- `event-title`: derive the group title from `<title>`.
- `douyu-stream-resolver`: resolve each roomId to a playable FLV/HLS URL.
- `playlist-writer`: write PotPlayer-compatible DPL first, with M3U fallback if needed.
- `cli`: command entry point used by PotPlayer.

## Discovery Strategy

Primary strategy:

- Request `https://www.douyu.com/601514`.
- Parse raw HTML for the event title and `wm-pc-switchroom`.

Fallback strategy:

- If raw HTML lacks `wm-pc-switchroom`, render the same URL with Playwright and read the DOM after page load.
- If the anchor room is unavailable or not showing an event, use the configured fallback event URL.
- If no event rooms can be found, return a clear error instead of producing an empty playlist silently.

The parser must not hard-code room IDs or labels. The attachment sample produced:

- `6979222`: `玩机器`
- `178432`: `QUQU`
- `63136`: `冬瓜`
- `601514`: `主舞台纯净流`
- `9392697`: `副舞台纯净流`

Those are examples, not fixed requirements.

## Stream Resolution

The resolver should resolve all discovered rooms concurrently with a bounded limit.

Rules:

- Prefer playable direct stream URLs that PotPlayer can open without browser cookies.
- Prefer configured quality where supported.
- If a room fails resolution, record the failure and continue resolving other rooms.
- If every room fails, return a failed result and do not claim success.
- Cache short-lived results only within a safe TTL, because Douyu real stream URLs may expire.

## Playlist Strategy

The preferred output is a DPL playlist:

- `playname` is the event title, for example `科隆MAJOR`.
- Each item `title` is the switch-room label.
- Each item `file` is the resolved live stream URL.

If PotPlayer does not display DPL `playname` as a folder-like group in practice, the fallback display rule is:

- Keep `playname` as the event title.
- Prefix item titles with the event title, for example `[科隆MAJOR] 玩机器`.

If DPL cannot carry a resolved live stream URL reliably, add an M3U/M3U8 writer and let PotPlayer load that file instead.

## Error Handling

The resolver returns structured JSON with:

- `ok`: boolean
- `eventTitle`: string when available
- `playlistPath`: path when created
- `rooms`: discovered rooms and per-room resolution status
- `errors`: top-level failures

Expected failure cases:

- Network timeout.
- Anchor page unreachable.
- Anchor page title missing or changed.
- `wm-pc-switchroom` missing.
- A room is offline.
- Douyu changes stream signing logic.
- PotPlayer cannot load the generated playlist format.

Each case should be logged with enough detail to reproduce the failing step.

## Verification

Minimum verification before declaring implementation complete:

1. Unit test parser against the provided `wm-pc-switchroom` sample and assert all five room IDs and labels are extracted.
2. Unit test title parsing with examples such as `科隆MAJOR_玩机器直播_玩机器丶Machine直播_玩机器CS2直播_玩机器斗鱼直播`.
3. Unit test DPL writer output shape.
4. Run the Node CLI against the default anchor URL.
5. Confirm the generated playlist can be opened by PotPlayer on the target machine.
6. If direct playlist grouping is not folder-like, verify the fallback title prefix behavior.

## Confidence And Loopholes

This strategy avoids the main unreliable assumption: PotPlayer AngelScript does not need to directly create GUI playlist folders. The package treats PotPlayer as the playback surface and lets Node handle unstable web extraction.

Remaining loopholes:

- Douyu may change `wm-pc-switchroom` class names or move the room data into a different runtime structure.
- Douyu real stream signing may change.
- Room `601514` may stop being a reliable CS2 event anchor.
- PotPlayer DPL grouping behavior must be verified locally.

Mitigations:

- Include Playwright DOM fallback.
- Keep stream signing logic isolated in one module.
- Allow anchor URL override.
- Include playlist format fallback.
