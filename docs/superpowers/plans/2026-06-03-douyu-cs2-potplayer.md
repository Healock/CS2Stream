# Douyu CS2 PotPlayer Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PotPlayer plugin package that discovers Douyu CS2 event switch-room entries from room `601514`, resolves their real live stream URLs, and generates a PotPlayer-loadable grouped playlist.

**Architecture:** PotPlayer stays thin and invokes a Node resolver. The Node resolver is organized around platform adapters, an auth context, Douyu page discovery, stream resolution, and playlist writing. The first implementation supports only Douyu CS2, while leaving explicit adapter and auth extension points for future Huya/Bilibili work.

**Tech Stack:** Node.js, TypeScript, Vitest, Cheerio, optional Playwright fallback, PotPlayer AngelScript, DPL/M3U playlist files.

---

## File Structure

- `package.json`: Node scripts, dependencies, and CLI metadata.
- `tsconfig.json`: TypeScript compiler settings.
- `vitest.config.ts`: Vitest configuration.
- `src/types.ts`: Shared domain types and structured result shapes.
- `src/config.ts`: Runtime config loading and defaults.
- `src/auth.ts`: Optional auth context and redaction helpers.
- `src/platforms/types.ts`: Platform adapter interface.
- `src/platforms/registry.ts`: Adapter selection by URL or room input.
- `src/platforms/douyu/title.ts`: Douyu event title parsing.
- `src/platforms/douyu/switchroom.ts`: `wm-pc-switchroom` parsing.
- `src/platforms/douyu/page.ts`: Anchor page fetching and optional rendering hook.
- `src/platforms/douyu/stream.ts`: Douyu real stream resolver.
- `src/platforms/douyu/adapter.ts`: Douyu adapter implementation.
- `src/playlist/dpl.ts`: DPL writer.
- `src/playlist/m3u.ts`: M3U fallback writer.
- `src/cli.ts`: Command entry point for PotPlayer and manual runs.
- `potplayer/MediaPlayParse - Douyu CS2.as`: PotPlayer AngelScript entry.
- `samples/wm-pc-switchroom.html`: Provided red-box sample fixture.
- `tests/*.test.ts`: Unit tests for parsing, auth, adapters, playlists, and CLI behavior.
- `README.md`: Install and usage instructions.

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/types.ts`
- Create: `samples/wm-pc-switchroom.html`

- [ ] **Step 1: Write the initial package file**

Create `package.json`:

```json
{
  "name": "douyu-cs2-potplayer",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "douyu-cs2-potplayer": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "cli": "node dist/cli.js"
  },
  "dependencies": {
    "cheerio": "^1.0.0",
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  },
  "optionalDependencies": {
    "playwright": "^1.45.0"
  }
}
```

- [ ] **Step 2: Add TypeScript config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Add Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
```

- [ ] **Step 4: Add shared types**

Create `src/types.ts`:

```ts
export type PlatformId = "douyu" | "huya" | "bilibili";

export interface AuthContext {
  cookieHeader?: string;
  source?: "none" | "cookie-file" | "browser-profile";
}

export interface EventRoom {
  platform: PlatformId;
  roomId: string;
  roomUrl: string;
  label: string;
}

export interface StreamCandidate {
  url: string;
  format: "flv" | "hls" | "unknown";
  quality?: string;
  requiresAuth?: boolean;
}

export interface ResolvedRoom extends EventRoom {
  ok: boolean;
  stream?: StreamCandidate;
  error?: ResolverError;
}

export interface ResolverError {
  code:
    | "network_error"
    | "anchor_unreachable"
    | "title_missing"
    | "switchroom_missing"
    | "auth_required"
    | "room_offline"
    | "stream_resolution_failed"
    | "unsupported_platform"
    | "playlist_write_failed";
  message: string;
}

export interface ResolverResult {
  ok: boolean;
  eventTitle?: string;
  playlistPath?: string;
  rooms: ResolvedRoom[];
  errors: ResolverError[];
}
```

- [ ] **Step 5: Save the supplied red-box fixture**

Create `samples/wm-pc-switchroom.html` using the pasted `wm-pc-switchroom` snippet. The fixture must contain the five links and labels:

```html
<div class="wm-pc-switchroom">
  <a href="https://www.douyu.com/6979222?dyshid=b7ca744"><div class="wm-pc-room-button-text">玩机器</div></a>
  <a href="https://www.douyu.com/178432?dyshid=b7ca744"><div class="wm-pc-room-button-text">QUQU</div></a>
  <a href="https://www.douyu.com/63136?dyshid=b7ca744"><div class="wm-pc-room-button-text">冬瓜</div></a>
  <a href="https://www.douyu.com/601514?dyshid=b7ca744"><div class="wm-pc-room-button-text">主舞台纯净流</div></a>
  <a href="https://www.douyu.com/9392697?dyshid=b7ca744"><div class="wm-pc-room-button-text">副舞台纯净流</div></a>
</div>
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and dependencies install successfully.

- [ ] **Step 7: Run scaffold verification**

Run: `npm run build`

Expected: PASS, TypeScript compiles with no source files beyond `src/types.ts`.

- [ ] **Step 8: Commit scaffold**

Run:

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts src/types.ts samples/wm-pc-switchroom.html
git commit -m "chore: scaffold Node resolver project"
```

## Task 2: Title And Switch-Room Parsing

**Files:**
- Create: `src/platforms/douyu/title.ts`
- Create: `src/platforms/douyu/switchroom.ts`
- Create: `tests/douyu-title.test.ts`
- Create: `tests/douyu-switchroom.test.ts`

- [ ] **Step 1: Write title parser tests**

Create `tests/douyu-title.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseDouyuEventTitle } from "../src/platforms/douyu/title.js";

describe("parseDouyuEventTitle", () => {
  it("uses the text before the first underscore", () => {
    expect(
      parseDouyuEventTitle("科隆MAJOR_玩机器直播_玩机器丶Machine直播_玩机器CS2直播_玩机器斗鱼直播")
    ).toBe("科隆MAJOR");
  });

  it("trims whitespace around the event name", () => {
    expect(parseDouyuEventTitle(" 科隆MAJOR _斗鱼CSGO赛事主频道直播")).toBe("科隆MAJOR");
  });

  it("returns undefined when title is empty", () => {
    expect(parseDouyuEventTitle("")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run title parser test and verify failure**

Run: `npm test -- tests/douyu-title.test.ts`

Expected: FAIL because `src/platforms/douyu/title.ts` does not exist.

- [ ] **Step 3: Implement title parser**

Create `src/platforms/douyu/title.ts`:

```ts
export function parseDouyuEventTitle(title: string): string | undefined {
  const firstPart = title.split("_", 1)[0]?.trim();
  return firstPart ? firstPart : undefined;
}
```

- [ ] **Step 4: Run title parser test and verify pass**

Run: `npm test -- tests/douyu-title.test.ts`

Expected: PASS.

- [ ] **Step 5: Write switch-room parser tests**

Create `tests/douyu-switchroom.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDouyuSwitchRooms } from "../src/platforms/douyu/switchroom.js";

describe("parseDouyuSwitchRooms", () => {
  it("extracts every displayed room from wm-pc-switchroom", () => {
    const html = readFileSync("samples/wm-pc-switchroom.html", "utf8");
    expect(parseDouyuSwitchRooms(html)).toEqual([
      { platform: "douyu", roomId: "6979222", roomUrl: "https://www.douyu.com/6979222", label: "玩机器" },
      { platform: "douyu", roomId: "178432", roomUrl: "https://www.douyu.com/178432", label: "QUQU" },
      { platform: "douyu", roomId: "63136", roomUrl: "https://www.douyu.com/63136", label: "冬瓜" },
      { platform: "douyu", roomId: "601514", roomUrl: "https://www.douyu.com/601514", label: "主舞台纯净流" },
      { platform: "douyu", roomId: "9392697", roomUrl: "https://www.douyu.com/9392697", label: "副舞台纯净流" }
    ]);
  });

  it("returns an empty array when the switch-room container is missing", () => {
    expect(parseDouyuSwitchRooms("<html></html>")).toEqual([]);
  });
});
```

- [ ] **Step 6: Run switch-room test and verify failure**

Run: `npm test -- tests/douyu-switchroom.test.ts`

Expected: FAIL because `parseDouyuSwitchRooms` does not exist.

- [ ] **Step 7: Implement switch-room parser**

Create `src/platforms/douyu/switchroom.ts`:

```ts
import * as cheerio from "cheerio";
import type { EventRoom } from "../../types.js";

export function parseDouyuSwitchRooms(html: string): EventRoom[] {
  const $ = cheerio.load(html);
  const rooms: EventRoom[] = [];
  const seen = new Set<string>();

  $(".wm-pc-switchroom a[href*='douyu.com/']").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    const match = href.match(/douyu\.com\/(\d+)/);
    if (!match) return;

    const roomId = match[1];
    if (seen.has(roomId)) return;

    const label = $(element).find(".wm-pc-room-button-text").first().text().trim();
    if (!label) return;

    seen.add(roomId);
    rooms.push({
      platform: "douyu",
      roomId,
      roomUrl: `https://www.douyu.com/${roomId}`,
      label
    });
  });

  return rooms;
}
```

- [ ] **Step 8: Run parser tests**

Run: `npm test -- tests/douyu-title.test.ts tests/douyu-switchroom.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit parsers**

Run:

```bash
git add src/platforms/douyu/title.ts src/platforms/douyu/switchroom.ts tests/douyu-title.test.ts tests/douyu-switchroom.test.ts
git commit -m "test: add Douyu event parsers"
```

## Task 3: Auth Context And Platform Registry

**Files:**
- Create: `src/auth.ts`
- Create: `src/platforms/types.ts`
- Create: `src/platforms/registry.ts`
- Create: `tests/auth.test.ts`
- Create: `tests/platform-registry.test.ts`

- [ ] **Step 1: Write auth redaction tests**

Create `tests/auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createAuthContext, redactSecret } from "../src/auth.js";

describe("auth helpers", () => {
  it("creates an empty auth context by default", () => {
    expect(createAuthContext()).toEqual({ source: "none" });
  });

  it("redacts cookie values from loggable strings", () => {
    expect(redactSecret("acf_auth=abc123; dy_did=secret456")).toBe("acf_auth=<redacted>; dy_did=<redacted>");
  });
});
```

- [ ] **Step 2: Run auth test and verify failure**

Run: `npm test -- tests/auth.test.ts`

Expected: FAIL because `src/auth.ts` does not exist.

- [ ] **Step 3: Implement auth helpers**

Create `src/auth.ts`:

```ts
import type { AuthContext } from "./types.js";

export function createAuthContext(cookieHeader?: string): AuthContext {
  if (!cookieHeader?.trim()) {
    return { source: "none" };
  }

  return {
    source: "cookie-file",
    cookieHeader: cookieHeader.trim()
  };
}

export function redactSecret(value: string): string {
  return value.replace(/([^=;\s]+)=([^;]+)/g, "$1=<redacted>");
}
```

- [ ] **Step 4: Run auth test and verify pass**

Run: `npm test -- tests/auth.test.ts`

Expected: PASS.

- [ ] **Step 5: Write platform registry tests**

Create `tests/platform-registry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PlatformAdapter } from "../src/platforms/types.js";
import { findPlatformAdapter } from "../src/platforms/registry.js";

const douyuAdapter: PlatformAdapter = {
  id: "douyu",
  detect: (input) => input.includes("douyu.com") || /^\d+$/.test(input),
  discoverEventRooms: async () => [],
  getEventTitle: async () => "科隆MAJOR",
  resolveStream: async () => []
};

describe("findPlatformAdapter", () => {
  it("returns the matching adapter", () => {
    expect(findPlatformAdapter("https://www.douyu.com/601514", [douyuAdapter])?.id).toBe("douyu");
  });

  it("returns undefined for unsupported input", () => {
    expect(findPlatformAdapter("https://example.com/room", [douyuAdapter])).toBeUndefined();
  });
});
```

- [ ] **Step 6: Run registry test and verify failure**

Run: `npm test -- tests/platform-registry.test.ts`

Expected: FAIL because platform types and registry do not exist.

- [ ] **Step 7: Implement platform types**

Create `src/platforms/types.ts`:

```ts
import type { AuthContext, EventRoom, PlatformId, StreamCandidate } from "../types.js";

export interface PlatformContext {
  auth: AuthContext;
  timeoutMs: number;
}

export interface PlatformAdapter {
  id: PlatformId;
  detect(input: string): boolean;
  discoverEventRooms(anchor: string, context: PlatformContext): Promise<EventRoom[]>;
  getEventTitle(anchor: string, context: PlatformContext): Promise<string | undefined>;
  resolveStream(room: EventRoom, context: PlatformContext): Promise<StreamCandidate[]>;
}
```

- [ ] **Step 8: Implement platform registry**

Create `src/platforms/registry.ts`:

```ts
import type { PlatformAdapter } from "./types.js";

export function findPlatformAdapter(input: string, adapters: PlatformAdapter[]): PlatformAdapter | undefined {
  return adapters.find((adapter) => adapter.detect(input));
}
```

- [ ] **Step 9: Run auth and registry tests**

Run: `npm test -- tests/auth.test.ts tests/platform-registry.test.ts`

Expected: PASS.

- [ ] **Step 10: Commit auth and platform registry**

Run:

```bash
git add src/auth.ts src/platforms/types.ts src/platforms/registry.ts tests/auth.test.ts tests/platform-registry.test.ts
git commit -m "feat: add auth and platform adapter contracts"
```

## Task 4: Playlist Writers

**Files:**
- Create: `src/playlist/dpl.ts`
- Create: `src/playlist/m3u.ts`
- Create: `tests/playlist.test.ts`

- [ ] **Step 1: Write playlist tests**

Create `tests/playlist.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ResolvedRoom } from "../src/types.js";
import { buildDpl } from "../src/playlist/dpl.js";
import { buildM3u } from "../src/playlist/m3u.js";

const rooms: ResolvedRoom[] = [
  {
    platform: "douyu",
    roomId: "601514",
    roomUrl: "https://www.douyu.com/601514",
    label: "主舞台纯净流",
    ok: true,
    stream: { url: "https://stream.example/live.flv", format: "flv", quality: "best" }
  }
];

describe("playlist writers", () => {
  it("builds DPL with playname and one playable item", () => {
    expect(buildDpl("科隆MAJOR", rooms)).toContain("playname=科隆MAJOR");
    expect(buildDpl("科隆MAJOR", rooms)).toContain("1*file*https://stream.example/live.flv");
    expect(buildDpl("科隆MAJOR", rooms)).toContain("1*title*主舞台纯净流");
  });

  it("prefixes item titles when requested", () => {
    expect(buildDpl("科隆MAJOR", rooms, { prefixTitles: true })).toContain("1*title*[科隆MAJOR] 主舞台纯净流");
  });

  it("builds M3U fallback", () => {
    expect(buildM3u("科隆MAJOR", rooms)).toBe("#EXTM3U\n#EXTINF:-1,主舞台纯净流\nhttps://stream.example/live.flv\n");
  });
});
```

- [ ] **Step 2: Run playlist tests and verify failure**

Run: `npm test -- tests/playlist.test.ts`

Expected: FAIL because playlist writers do not exist.

- [ ] **Step 3: Implement DPL writer**

Create `src/playlist/dpl.ts`:

```ts
import type { ResolvedRoom } from "../types.js";

export interface DplOptions {
  prefixTitles?: boolean;
}

export function buildDpl(eventTitle: string, rooms: ResolvedRoom[], options: DplOptions = {}): string {
  const playableRooms = rooms.filter((room) => room.ok && room.stream?.url);
  const lines = ["DAUMPLAYLIST", `playname=${eventTitle}`, "topindex=0", "saveplaypos=0"];

  playableRooms.forEach((room, index) => {
    const item = index + 1;
    const title = options.prefixTitles ? `[${eventTitle}] ${room.label}` : room.label;
    lines.push(`${item}*file*${room.stream?.url ?? ""}`);
    lines.push(`${item}*title*${title}`);
  });

  return `${lines.join("\n")}\n`;
}
```

- [ ] **Step 4: Implement M3U writer**

Create `src/playlist/m3u.ts`:

```ts
import type { ResolvedRoom } from "../types.js";

export function buildM3u(_eventTitle: string, rooms: ResolvedRoom[]): string {
  const lines = ["#EXTM3U"];

  for (const room of rooms) {
    if (!room.ok || !room.stream?.url) continue;
    lines.push(`#EXTINF:-1,${room.label}`);
    lines.push(room.stream.url);
  }

  return `${lines.join("\n")}\n`;
}
```

- [ ] **Step 5: Run playlist tests and verify pass**

Run: `npm test -- tests/playlist.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit playlist writers**

Run:

```bash
git add src/playlist/dpl.ts src/playlist/m3u.ts tests/playlist.test.ts
git commit -m "feat: add playlist writers"
```

## Task 5: Douyu Page Fetching And Adapter

**Files:**
- Create: `src/platforms/douyu/page.ts`
- Create: `src/platforms/douyu/adapter.ts`
- Create: `tests/douyu-adapter.test.ts`

- [ ] **Step 1: Write Douyu adapter tests**

Create `tests/douyu-adapter.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createDouyuAdapter } from "../src/platforms/douyu/adapter.js";
import type { PlatformContext } from "../src/platforms/types.js";

const context: PlatformContext = { auth: { source: "none" }, timeoutMs: 1000 };

describe("Douyu adapter", () => {
  it("detects Douyu URLs and numeric room IDs", () => {
    const adapter = createDouyuAdapter({ fetchHtml: async () => "" });
    expect(adapter.detect("https://www.douyu.com/601514")).toBe(true);
    expect(adapter.detect("601514")).toBe(true);
    expect(adapter.detect("https://example.com/601514")).toBe(false);
  });

  it("extracts title and switch-room rooms from fetched HTML", async () => {
    const html = `
      <html>
        <head><title>科隆MAJOR_斗鱼CSGO赛事主频道直播</title></head>
        <body>
          <div class="wm-pc-switchroom">
            <a href="https://www.douyu.com/601514"><div class="wm-pc-room-button-text">主舞台纯净流</div></a>
          </div>
        </body>
      </html>`;
    const fetchHtml = vi.fn(async () => html);
    const adapter = createDouyuAdapter({ fetchHtml });

    await expect(adapter.getEventTitle("https://www.douyu.com/601514", context)).resolves.toBe("科隆MAJOR");
    await expect(adapter.discoverEventRooms("https://www.douyu.com/601514", context)).resolves.toEqual([
      { platform: "douyu", roomId: "601514", roomUrl: "https://www.douyu.com/601514", label: "主舞台纯净流" }
    ]);
  });
});
```

- [ ] **Step 2: Run Douyu adapter tests and verify failure**

Run: `npm test -- tests/douyu-adapter.test.ts`

Expected: FAIL because adapter files do not exist.

- [ ] **Step 3: Implement page fetching**

Create `src/platforms/douyu/page.ts`:

```ts
import type { AuthContext } from "../../types.js";

export async function fetchDouyuHtml(url: string, auth: AuthContext, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 PotPlayer-Douyu-CS2-Resolver/0.1",
        ...(auth.cookieHeader ? { Cookie: auth.cookieHeader } : {})
      }
    });

    if (!response.ok) {
      throw new Error(`Douyu page request failed with HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Implement Douyu adapter**

Create `src/platforms/douyu/adapter.ts`:

```ts
import * as cheerio from "cheerio";
import type { EventRoom, StreamCandidate } from "../../types.js";
import type { PlatformAdapter, PlatformContext } from "../types.js";
import { fetchDouyuHtml } from "./page.js";
import { parseDouyuSwitchRooms } from "./switchroom.js";
import { parseDouyuEventTitle } from "./title.js";

export interface DouyuAdapterDeps {
  fetchHtml?: (url: string, context: PlatformContext) => Promise<string>;
  resolveStream?: (room: EventRoom, context: PlatformContext) => Promise<StreamCandidate[]>;
}

export function createDouyuAdapter(deps: DouyuAdapterDeps = {}): PlatformAdapter {
  const fetchHtml = deps.fetchHtml ?? ((url, context) => fetchDouyuHtml(url, context.auth, context.timeoutMs));
  const resolveStream = deps.resolveStream ?? (async () => []);

  return {
    id: "douyu",
    detect(input: string): boolean {
      return input.includes("douyu.com") || /^\d+$/.test(input);
    },
    async getEventTitle(anchor: string, context: PlatformContext): Promise<string | undefined> {
      const html = await fetchHtml(normalizeDouyuAnchor(anchor), context);
      const $ = cheerio.load(html);
      return parseDouyuEventTitle($("title").first().text());
    },
    async discoverEventRooms(anchor: string, context: PlatformContext): Promise<EventRoom[]> {
      const html = await fetchHtml(normalizeDouyuAnchor(anchor), context);
      return parseDouyuSwitchRooms(html);
    },
    resolveStream
  };
}

export function normalizeDouyuAnchor(input: string): string {
  if (/^\d+$/.test(input)) {
    return `https://www.douyu.com/${input}`;
  }

  return input;
}
```

- [ ] **Step 5: Run Douyu adapter tests**

Run: `npm test -- tests/douyu-adapter.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit Douyu adapter**

Run:

```bash
git add src/platforms/douyu/page.ts src/platforms/douyu/adapter.ts tests/douyu-adapter.test.ts
git commit -m "feat: add Douyu page adapter"
```

## Task 6: Douyu Stream Resolver Boundary

**Files:**
- Create: `src/platforms/douyu/stream.ts`
- Modify: `src/platforms/douyu/adapter.ts`
- Create: `tests/douyu-stream.test.ts`

- [ ] **Step 1: Write stream resolver boundary tests**

Create `tests/douyu-stream.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveDouyuStreamFromApiPayload } from "../src/platforms/douyu/stream.js";

describe("resolveDouyuStreamFromApiPayload", () => {
  it("returns a FLV candidate from a direct rtmp_url and rtmp_live payload", () => {
    expect(
      resolveDouyuStreamFromApiPayload({
        rtmp_url: "https://example.douyucdn.cn/live",
        rtmp_live: "601514abc.flv",
        rate: 0
      })
    ).toEqual([{ url: "https://example.douyucdn.cn/live/601514abc.flv", format: "flv", quality: "best" }]);
  });

  it("marks cookie-bound streams as requiring authentication", () => {
    expect(
      resolveDouyuStreamFromApiPayload({
        url: "https://example.douyucdn.cn/live/auth.flv",
        requiresAuth: true
      })
    ).toEqual([{ url: "https://example.douyucdn.cn/live/auth.flv", format: "flv", requiresAuth: true }]);
  });

  it("returns no candidates for empty payloads", () => {
    expect(resolveDouyuStreamFromApiPayload({})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run stream boundary tests and verify failure**

Run: `npm test -- tests/douyu-stream.test.ts`

Expected: FAIL because `src/platforms/douyu/stream.ts` does not exist.

- [ ] **Step 3: Implement stream payload parser**

Create `src/platforms/douyu/stream.ts`:

```ts
import type { StreamCandidate } from "../../types.js";

interface DouyuStreamPayload {
  rtmp_url?: string;
  rtmp_live?: string;
  url?: string;
  rate?: number;
  requiresAuth?: boolean;
}

export function resolveDouyuStreamFromApiPayload(payload: DouyuStreamPayload): StreamCandidate[] {
  const directUrl = payload.url ?? joinDouyuStreamUrl(payload.rtmp_url, payload.rtmp_live);
  if (!directUrl) return [];

  return [
    {
      url: directUrl,
      format: inferFormat(directUrl),
      quality: payload.rate === 0 ? "best" : undefined,
      requiresAuth: payload.requiresAuth || undefined
    }
  ];
}

function joinDouyuStreamUrl(base?: string, live?: string): string | undefined {
  if (!base || !live) return undefined;
  return `${base.replace(/\/$/, "")}/${live.replace(/^\//, "")}`;
}

function inferFormat(url: string): "flv" | "hls" | "unknown" {
  if (url.includes(".flv")) return "flv";
  if (url.includes(".m3u8")) return "hls";
  return "unknown";
}
```

- [ ] **Step 4: Wire stream resolver into Douyu adapter**

Modify `src/platforms/douyu/adapter.ts`:

```ts
import * as cheerio from "cheerio";
import type { EventRoom, StreamCandidate } from "../../types.js";
import type { PlatformAdapter, PlatformContext } from "../types.js";
import { fetchDouyuHtml } from "./page.js";
import { parseDouyuSwitchRooms } from "./switchroom.js";
import { parseDouyuEventTitle } from "./title.js";
import { resolveDouyuRoomStream } from "./stream.js";

export interface DouyuAdapterDeps {
  fetchHtml?: (url: string, context: PlatformContext) => Promise<string>;
  resolveStream?: (room: EventRoom, context: PlatformContext) => Promise<StreamCandidate[]>;
}

export function createDouyuAdapter(deps: DouyuAdapterDeps = {}): PlatformAdapter {
  const fetchHtml = deps.fetchHtml ?? ((url, context) => fetchDouyuHtml(url, context.auth, context.timeoutMs));
  const resolveStream = deps.resolveStream ?? resolveDouyuRoomStream;

  return {
    id: "douyu",
    detect(input: string): boolean {
      return input.includes("douyu.com") || /^\d+$/.test(input);
    },
    async getEventTitle(anchor: string, context: PlatformContext): Promise<string | undefined> {
      const html = await fetchHtml(normalizeDouyuAnchor(anchor), context);
      const $ = cheerio.load(html);
      return parseDouyuEventTitle($("title").first().text());
    },
    async discoverEventRooms(anchor: string, context: PlatformContext): Promise<EventRoom[]> {
      const html = await fetchHtml(normalizeDouyuAnchor(anchor), context);
      return parseDouyuSwitchRooms(html);
    },
    resolveStream
  };
}

export function normalizeDouyuAnchor(input: string): string {
  if (/^\d+$/.test(input)) {
    return `https://www.douyu.com/${input}`;
  }

  return input;
}
```

Also update `src/platforms/douyu/stream.ts` so all imports stay at the top and the room resolver stub is exported:

```ts
import type { EventRoom, StreamCandidate } from "../../types.js";
import type { PlatformContext } from "../types.js";

interface DouyuStreamPayload {
  rtmp_url?: string;
  rtmp_live?: string;
  url?: string;
  rate?: number;
  requiresAuth?: boolean;
}

export function resolveDouyuStreamFromApiPayload(payload: DouyuStreamPayload): StreamCandidate[] {
  const directUrl = payload.url ?? joinDouyuStreamUrl(payload.rtmp_url, payload.rtmp_live);
  if (!directUrl) return [];

  return [
    {
      url: directUrl,
      format: inferFormat(directUrl),
      quality: payload.rate === 0 ? "best" : undefined,
      requiresAuth: payload.requiresAuth || undefined
    }
  ];
}

export async function resolveDouyuRoomStream(_room: EventRoom, _context: PlatformContext): Promise<StreamCandidate[]> {
  return [];
}

function joinDouyuStreamUrl(base?: string, live?: string): string | undefined {
  if (!base || !live) return undefined;
  return `${base.replace(/\/$/, "")}/${live.replace(/^\//, "")}`;
}

function inferFormat(url: string): "flv" | "hls" | "unknown" {
  if (url.includes(".flv")) return "flv";
  if (url.includes(".m3u8")) return "hls";
  return "unknown";
}
```

This replaces the earlier `src/platforms/douyu/stream.ts` content from Step 3.

- [ ] **Step 5: Run stream and adapter tests**

Run: `npm test -- tests/douyu-stream.test.ts tests/douyu-adapter.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit stream boundary**

Run:

```bash
git add src/platforms/douyu/stream.ts src/platforms/douyu/adapter.ts tests/douyu-stream.test.ts
git commit -m "feat: add Douyu stream resolver boundary"
```

## Task 7: Resolver Orchestration And CLI

**Files:**
- Create: `src/config.ts`
- Create: `src/resolver.ts`
- Create: `src/cli.ts`
- Create: `tests/resolver.test.ts`
- Create: `tests/cli.test.ts`

- [ ] **Step 1: Write resolver tests**

Create `tests/resolver.test.ts`:

```ts
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PlatformAdapter } from "../src/platforms/types.js";
import { runResolver } from "../src/resolver.js";

describe("runResolver", () => {
  it("creates a playlist when at least one room resolves", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "douyu-cs2-"));
    const adapter: PlatformAdapter = {
      id: "douyu",
      detect: () => true,
      getEventTitle: async () => "科隆MAJOR",
      discoverEventRooms: async () => [
        { platform: "douyu", roomId: "601514", roomUrl: "https://www.douyu.com/601514", label: "主舞台纯净流" }
      ],
      resolveStream: async () => [{ url: "https://stream.example/live.flv", format: "flv" }]
    };

    const result = await runResolver({ anchor: "https://www.douyu.com/601514", outputDir: outDir, adapters: [adapter] });

    expect(result.ok).toBe(true);
    expect(result.eventTitle).toBe("科隆MAJOR");
    expect(result.playlistPath).toBeDefined();
    expect(readFileSync(result.playlistPath!, "utf8")).toContain("1*file*https://stream.example/live.flv");
  });

  it("fails clearly for unsupported platforms", async () => {
    const result = await runResolver({ anchor: "https://example.com/room", adapters: [] });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("unsupported_platform");
  });
});
```

- [ ] **Step 2: Run resolver tests and verify failure**

Run: `npm test -- tests/resolver.test.ts`

Expected: FAIL because `src/resolver.ts` does not exist.

- [ ] **Step 3: Implement config defaults**

Create `src/config.ts`:

```ts
export interface ResolverConfig {
  anchor: string;
  outputDir: string;
  timeoutMs: number;
  prefixTitles: boolean;
}

export function createDefaultConfig(overrides: Partial<ResolverConfig> = {}): ResolverConfig {
  return {
    anchor: "https://www.douyu.com/601514",
    outputDir: "out",
    timeoutMs: 15000,
    prefixTitles: false,
    ...overrides
  };
}
```

- [ ] **Step 4: Implement resolver orchestration**

Create `src/resolver.ts`:

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createAuthContext } from "./auth.js";
import { createDefaultConfig, type ResolverConfig } from "./config.js";
import { buildDpl } from "./playlist/dpl.js";
import type { PlatformAdapter } from "./platforms/types.js";
import { findPlatformAdapter } from "./platforms/registry.js";
import { createDouyuAdapter } from "./platforms/douyu/adapter.js";
import type { ResolvedRoom, ResolverResult } from "./types.js";

export interface RunResolverOptions extends Partial<ResolverConfig> {
  adapters?: PlatformAdapter[];
  cookieHeader?: string;
}

export async function runResolver(options: RunResolverOptions = {}): Promise<ResolverResult> {
  const config = createDefaultConfig(options);
  const adapters = options.adapters ?? [createDouyuAdapter()];
  const adapter = findPlatformAdapter(config.anchor, adapters);

  if (!adapter) {
    return {
      ok: false,
      rooms: [],
      errors: [{ code: "unsupported_platform", message: `No platform adapter supports ${config.anchor}` }]
    };
  }

  const context = {
    auth: createAuthContext(options.cookieHeader),
    timeoutMs: config.timeoutMs
  };

  const eventTitle = await adapter.getEventTitle(config.anchor, context);
  if (!eventTitle) {
    return {
      ok: false,
      rooms: [],
      errors: [{ code: "title_missing", message: "Could not derive event title from anchor page" }]
    };
  }

  const rooms = await adapter.discoverEventRooms(config.anchor, context);
  if (rooms.length === 0) {
    return {
      ok: false,
      eventTitle,
      rooms: [],
      errors: [{ code: "switchroom_missing", message: "No rooms found in wm-pc-switchroom" }]
    };
  }

  const resolvedRooms: ResolvedRoom[] = await Promise.all(
    rooms.map(async (room) => {
      const candidates = await adapter.resolveStream(room, context);
      const stream = candidates.find((candidate) => !candidate.requiresAuth);

      if (!stream && candidates.some((candidate) => candidate.requiresAuth)) {
        return {
          ...room,
          ok: false,
          error: { code: "auth_required", message: `${room.label} requires account authentication` }
        };
      }

      if (!stream) {
        return {
          ...room,
          ok: false,
          error: { code: "stream_resolution_failed", message: `${room.label} did not produce a playable stream` }
        };
      }

      return { ...room, ok: true, stream };
    })
  );

  const playableCount = resolvedRooms.filter((room) => room.ok).length;
  if (playableCount === 0) {
    return {
      ok: false,
      eventTitle,
      rooms: resolvedRooms,
      errors: resolvedRooms.map((room) => room.error).filter((error): error is NonNullable<typeof error> => Boolean(error))
    };
  }

  mkdirSync(config.outputDir, { recursive: true });
  const playlistPath = join(config.outputDir, `${sanitizeFileName(eventTitle)}.dpl`);
  writeFileSync(playlistPath, buildDpl(eventTitle, resolvedRooms, { prefixTitles: config.prefixTitles }), "utf8");

  return {
    ok: true,
    eventTitle,
    playlistPath,
    rooms: resolvedRooms,
    errors: resolvedRooms.map((room) => room.error).filter((error): error is NonNullable<typeof error> => Boolean(error))
  };
}

function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_");
}
```

- [ ] **Step 5: Run resolver tests**

Run: `npm test -- tests/resolver.test.ts`

Expected: PASS.

- [ ] **Step 6: Write CLI smoke test**

Create `tests/cli.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDefaultConfig } from "../src/config.js";

describe("CLI defaults", () => {
  it("uses room 601514 as the default anchor", () => {
    expect(createDefaultConfig().anchor).toBe("https://www.douyu.com/601514");
  });
});
```

- [ ] **Step 7: Implement CLI**

Create `src/cli.ts`:

```ts
#!/usr/bin/env node
import { Command } from "commander";
import { runResolver } from "./resolver.js";

const program = new Command();

program
  .option("-a, --anchor <url>", "Douyu anchor URL or room ID", "https://www.douyu.com/601514")
  .option("-o, --output-dir <path>", "Playlist output directory", "out")
  .option("--prefix-titles", "Prefix playlist item titles with the event title")
  .action(async (options) => {
    const result = await runResolver({
      anchor: options.anchor,
      outputDir: options.outputDir,
      prefixTitles: Boolean(options.prefixTitles)
    });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.ok ? 0 : 1;
  });

await program.parseAsync();
```

- [ ] **Step 8: Run resolver and CLI tests**

Run: `npm test -- tests/resolver.test.ts tests/cli.test.ts`

Expected: PASS.

- [ ] **Step 9: Build CLI**

Run: `npm run build`

Expected: PASS and `dist/cli.js` exists.

- [ ] **Step 10: Commit resolver and CLI**

Run:

```bash
git add src/config.ts src/resolver.ts src/cli.ts tests/resolver.test.ts tests/cli.test.ts
git commit -m "feat: add resolver CLI orchestration"
```

## Task 8: PotPlayer AngelScript Entry And Docs

**Files:**
- Create: `potplayer/MediaPlayParse - Douyu CS2.as`
- Create: `README.md`

- [ ] **Step 1: Add PotPlayer AngelScript entry**

Create `potplayer/MediaPlayParse - Douyu CS2.as`:

```angelscript
// PotPlayer Media PlayParse extension entry for Douyu CS2.
// The Node resolver owns Douyu extraction; this script only documents the entry path
// until local PotPlayer AngelScript command execution is verified on the target machine.

string GetTitle()
{
    return "Douyu CS2 Event Resolver";
}

string GetVersion()
{
    return "0.1.0";
}

string GetDesc()
{
    return "Resolve Douyu CS2 event rooms through the Node helper and load the generated playlist.";
}
```

- [ ] **Step 2: Add README**

Create `README.md`:

```md
# Douyu CS2 PotPlayer Plugin

This package resolves the rooms displayed in the Douyu CS2 event switch-room area and generates a PotPlayer-loadable playlist.

## Current Scope

- Default anchor: `https://www.douyu.com/601514`
- First platform: Douyu only
- Future extension points: account/cookie auth, Huya, Bilibili

## Development

```powershell
npm install
npm test
npm run build
node dist/cli.js --anchor https://www.douyu.com/601514 --output-dir out
```

The CLI prints structured JSON. On success, `playlistPath` points to the generated DPL file.

## PotPlayer

The PotPlayer AngelScript file is in `potplayer/`. Install it under the matching PotPlayer extension directory after verifying the local PotPlayer script execution API.

If PotPlayer does not display DPL `playname` as a folder-like group, run the CLI with `--prefix-titles`.
```

- [ ] **Step 3: Run build and tests**

Run: `npm test && npm run build`

Expected: PASS.

- [ ] **Step 4: Commit PotPlayer entry and docs**

Run:

```bash
git add potplayer/MediaPlayParse\ -\ Douyu\ CS2.as README.md
git commit -m "docs: add PotPlayer entry and usage"
```

## Task 9: Live Verification

**Files:**
- Modify only if verification finds a concrete bug.

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run TypeScript build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Run live CLI against default anchor**

Run: `node dist/cli.js --anchor https://www.douyu.com/601514 --output-dir out`

Expected:

- Exit code `0` if live stream resolution works.
- JSON contains `ok: true`, `eventTitle`, `playlistPath`, and at least one `rooms[].ok: true`.

If the command exits non-zero because `wm-pc-switchroom` is missing, inspect whether raw HTML lacks the rendered event room DOM and add the Playwright fallback as a follow-up task before claiming completion.

If the command exits non-zero because every room has `stream_resolution_failed`, inspect Douyu stream signing and implement the current live `getH5Play` flow before claiming completion.

- [ ] **Step 4: Open generated playlist in PotPlayer**

Open the generated DPL file in PotPlayer.

Expected:

- PotPlayer loads the event playlist.
- At least one resolved room starts playback.
- If the playlist does not look folder-like, rerun the CLI with `--prefix-titles` and verify item names include `[eventTitle]`.

- [ ] **Step 5: Commit verification fixes**

If any fixes were required, run:

```bash
git add <changed-files>
git commit -m "fix: complete live Douyu verification"
```

If no fixes were required, do not create an empty commit.

## Plan Self-Review

- Spec coverage: Covered Node resolver, PotPlayer thin entry, `601514` anchor, `wm-pc-switchroom`, title parsing, DPL/M3U strategy, auth context, platform adapter extension, error handling, and verification.
- Scope: First implementation remains Douyu CS2 only. Huya and Bilibili are represented by adapter boundaries, not implemented.
- Red-flag scan: No planned step relies on unspecified behavior. The only unknowns are live Douyu signing and PotPlayer local API behavior, both isolated into explicit verification/follow-up conditions.
- Type consistency: Shared types are defined before tests and reused consistently by adapters, playlists, and resolver orchestration.
