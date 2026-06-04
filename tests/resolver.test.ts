import { closeSync, mkdtempSync, openSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { PlatformAdapter } from "../src/platforms/types.js";
import { runResolver } from "../src/resolver.js";

const resolvingAdapter: PlatformAdapter = {
  id: "douyu",
  detect: () => true,
  getEventTitle: async () => "科隆MAJOR",
  discoverEventRooms: async () => [
    {
      platform: "douyu",
      roomId: "601514",
      roomUrl: "https://www.douyu.com/601514",
      label: "主舞台纯净流",
    },
  ],
  resolveStream: async () => [{ url: "https://stream.example/live.flv", format: "flv" }],
};

describe("runResolver", () => {
  it("creates a playlist when at least one room resolves", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "douyu-cs2-"));

    const result = await runResolver({
      anchor: "https://www.douyu.com/601514",
      outputDir: outDir,
      adapters: [resolvingAdapter],
    });

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

  it("returns a structured failure when multiple adapters detect the anchor", async () => {
    const result = await runResolver({
      anchor: "https://www.douyu.com/601514",
      adapters: [resolvingAdapter, { ...resolvingAdapter, id: "huya" }],
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("unsupported_platform");
  });

  it("returns a structured failure when event title lookup throws", async () => {
    const result = await runResolver({
      anchor: "https://www.douyu.com/601514",
      adapters: [{ ...resolvingAdapter, getEventTitle: async () => { throw new Error("title fetch failed"); } }],
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatchObject({ code: "anchor_unreachable", message: "title fetch failed" });
  });

  it("returns a structured failure when room discovery throws", async () => {
    const result = await runResolver({
      anchor: "https://www.douyu.com/601514",
      adapters: [{ ...resolvingAdapter, discoverEventRooms: async () => { throw new Error("rooms fetch failed"); } }],
    });

    expect(result.ok).toBe(false);
    expect(result.eventTitle).toBe("科隆MAJOR");
    expect(result.errors[0]).toMatchObject({ code: "anchor_unreachable", message: "rooms fetch failed" });
  });

  it("marks a room failed when stream resolution throws and continues other rooms", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "douyu-cs2-"));
    const adapter: PlatformAdapter = {
      ...resolvingAdapter,
      discoverEventRooms: async () => [
        { platform: "douyu", roomId: "1", roomUrl: "https://www.douyu.com/1", label: "bad room" },
        { platform: "douyu", roomId: "2", roomUrl: "https://www.douyu.com/2", label: "good room" },
      ],
      resolveStream: async (room) => {
        if (room.roomId === "1") {
          throw new Error("stream failed");
        }

        return [{ url: "https://stream.example/good.flv", format: "flv" }];
      },
    };

    const result = await runResolver({
      anchor: "https://www.douyu.com/601514",
      outputDir: outDir,
      adapters: [adapter],
      cleanStreamFilter: "all",
    });

    expect(result.ok).toBe(true);
    expect(result.rooms).toHaveLength(2);
    expect(result.rooms.find((room) => room.roomId === "1")?.error).toMatchObject({
      code: "stream_resolution_failed",
      message: "stream failed",
    });
    expect(result.rooms.find((room) => room.roomId === "2")?.ok).toBe(true);
    expect(result.errors).toHaveLength(1);
  });

  it("defaults to only resolving rooms whose labels contain pure stream text", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "douyu-cs2-"));
    const adapter: PlatformAdapter = {
      ...resolvingAdapter,
      discoverEventRooms: async () => [
        { platform: "douyu", roomId: "1", roomUrl: "https://www.douyu.com/1", label: "Major主舞台纯净流" },
        { platform: "douyu", roomId: "2", roomUrl: "https://www.douyu.com/2", label: "主播二路解说" },
      ],
      resolveStream: async (room) => [{ url: `https://stream.example/${room.roomId}.flv`, format: "flv" }],
    };

    const result = await runResolver({
      anchor: "https://www.douyu.com/601514",
      outputDir: outDir,
      adapters: [adapter],
    });

    expect(result.ok).toBe(true);
    expect(result.rooms.map((room) => room.label)).toEqual(["Major主舞台纯净流"]);
    expect(readFileSync(result.playlistPath!, "utf8")).toContain("Major主舞台纯净流");
    expect(readFileSync(result.playlistPath!, "utf8")).not.toContain("主播二路解说");
  });

  it("can resolve all rooms when clean stream filtering is disabled", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "douyu-cs2-"));
    const adapter: PlatformAdapter = {
      ...resolvingAdapter,
      discoverEventRooms: async () => [
        { platform: "douyu", roomId: "1", roomUrl: "https://www.douyu.com/1", label: "Major主舞台纯净流" },
        { platform: "douyu", roomId: "2", roomUrl: "https://www.douyu.com/2", label: "主播二路解说" },
      ],
      resolveStream: async (room) => [{ url: `https://stream.example/${room.roomId}.flv`, format: "flv" }],
    };

    const result = await runResolver({
      anchor: "https://www.douyu.com/601514",
      outputDir: outDir,
      adapters: [adapter],
      cleanStreamFilter: "all",
    });

    expect(result.ok).toBe(true);
    expect(result.rooms.map((room) => room.label)).toEqual(["Major主舞台纯净流", "主播二路解说"]);
  });

  it("keeps official Huya CS2 event anchors under the default clean-only policy", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "huya-clean-official-"));
    const adapter: PlatformAdapter = {
      id: "huya",
      detect: (input) => input.includes("huya"),
      getEventTitle: async () => "IEM Cologne",
      discoverEventRooms: async () => [
        { platform: "huya", roomId: "483917", roomUrl: "https://www.huya.com/eslcs", label: "IEM科隆Major Stage1" },
      ],
      resolveStream: async () => [{ url: "https://stream.example/huya.flv", format: "flv" }],
    };

    const result = await runResolver({
      anchor: "https://www.huya.com/eslcs",
      outputDir: outDir,
      adapters: [adapter],
    });

    expect(result.ok).toBe(true);
    expect(result.rooms.map((room) => room.roomUrl)).toEqual(["https://www.huya.com/eslcs"]);
  });

  it("returns a clear failure when clean-only filtering removes every room", async () => {
    const result = await runResolver({
      anchor: "https://www.douyu.com/601514",
      adapters: [{
        ...resolvingAdapter,
        discoverEventRooms: async () => [
          { platform: "douyu", roomId: "1", roomUrl: "https://www.douyu.com/1", label: "主播二路解说" },
        ],
      }],
    });

    expect(result.ok).toBe(false);
    expect(result.eventTitle).toBe("科隆MAJOR");
    expect(result.rooms).toEqual([]);
    expect(result.errors[0]).toMatchObject({
      code: "clean_stream_missing",
      message: "No rooms found with titles containing 纯净流",
    });
  });

  it("aggregates rooms from multiple platform anchors and keeps per-anchor failures isolated", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "cs2stream-multi-"));
    const douyuAdapter: PlatformAdapter = {
      id: "douyu",
      detect: (input) => input.includes("douyu"),
      getEventTitle: async () => "Test Major",
      discoverEventRooms: async () => [
        { platform: "douyu", roomId: "601514", roomUrl: "https://www.douyu.com/601514", label: "Main clean" },
      ],
      resolveStream: async () => [{ url: "https://stream.example/douyu.flv", format: "flv" }],
    };
    const huyaAdapter: PlatformAdapter = {
      id: "huya",
      detect: (input) => input.includes("huya"),
      getEventTitle: async () => "Ignored Huya Title",
      discoverEventRooms: async () => [
        { platform: "huya", roomId: "660000", roomUrl: "https://www.huya.com/eslcsgo2", label: "Huya clean" },
      ],
      resolveStream: async () => [{ url: "https://stream.example/huya.flv", format: "flv" }],
    };
    const bilibiliAdapter: PlatformAdapter = {
      id: "bilibili",
      detect: (input) => input.includes("bilibili"),
      getEventTitle: async () => "Ignored Bili Title",
      discoverEventRooms: async () => [
        { platform: "bilibili", roomId: "35", roomUrl: "https://live.bilibili.com/35", label: "Bili clean" },
      ],
      resolveStream: async () => [],
    };

    const result = await runResolver({
      anchors: ["https://www.douyu.com/601514", "https://www.huya.com/eslcsgo2", "https://live.bilibili.com/35"],
      outputDir: outDir,
      adapters: [douyuAdapter, huyaAdapter, bilibiliAdapter],
      cleanStreamFilter: "all",
    });

    expect(result.ok).toBe(true);
    expect(result.eventTitle).toBe("Test Major");
    expect(result.rooms.map((room) => room.platform)).toEqual(["douyu", "huya", "bilibili"]);
    expect(result.rooms.filter((room) => room.ok).map((room) => room.stream?.url)).toEqual([
      "https://stream.example/douyu.flv",
      "https://stream.example/huya.flv",
    ]);
    expect(result.rooms.find((room) => room.platform === "bilibili")?.error?.code).toBe("stream_resolution_failed");

    const playlist = readFileSync(result.playlistPath!, "utf8");
    expect(playlist).toContain("1*title*1-Main clean");
    expect(playlist).toContain("2*title*2-Huya clean");
    expect(playlist).not.toContain("3-Bili clean");
  });

  it("suppresses empty-anchor errors when another configured anchor resolves playable rooms", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "cs2stream-empty-anchor-"));
    const adapter: PlatformAdapter = {
      id: "huya",
      detect: (input) => input.includes("huya"),
      getEventTitle: async () => "IEM Cologne",
      discoverEventRooms: async (anchor) => anchor.includes("empty") ? [] : [
        { platform: "huya", roomId: "1", roomUrl: "https://www.huya.com/eslcs", label: "Huya live" },
      ],
      resolveStream: async () => [{ url: "https://stream.example/huya.flv", format: "flv" }],
    };

    const result = await runResolver({
      anchors: ["https://www.huya.com/eslcs", "https://www.huya.com/empty"],
      outputDir: outDir,
      adapters: [adapter],
      cleanStreamFilter: "all",
    });

    expect(result.ok).toBe(true);
    expect(result.rooms).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });

  it("passes browser cookies only to their matching platform adapter", async () => {
    const seenAuth = new Map<string, string | undefined>();
    const adapters: PlatformAdapter[] = (["douyu", "bilibili"] as const).map((platform) => ({
      id: platform,
      detect: (input) => input.includes(platform === "douyu" ? "douyu" : "bilibili"),
      getEventTitle: async (_anchor, context) => {
        seenAuth.set(`${platform}:title`, context.auth.cookieHeader);
        return "Cookie Test";
      },
      discoverEventRooms: async (_anchor, context) => {
        seenAuth.set(`${platform}:rooms`, context.auth.cookieHeader);
        return [{ platform, roomId: platform, roomUrl: `https://${platform}.example/room`, label: `${platform} clean` }];
      },
      resolveStream: async (_room, context) => {
        seenAuth.set(`${platform}:stream`, context.auth.cookieHeader);
        return [{ url: `https://stream.example/${platform}.flv`, format: "flv" }];
      },
    }));

    const result = await runResolver({
      anchors: ["https://www.douyu.com/601514", "https://live.bilibili.com/35"],
      outputDir: mkdtempSync(join(tmpdir(), "cs2stream-cookie-platform-")),
      cleanStreamFilter: "all",
      adapters,
      platformCookieHeaders: {
        bilibili: "SESSDATA=abc",
      },
    });

    expect(result.ok).toBe(true);
    expect(seenAuth.get("douyu:title")).toBeUndefined();
    expect(seenAuth.get("douyu:rooms")).toBeUndefined();
    expect(seenAuth.get("douyu:stream")).toBeUndefined();
    expect(seenAuth.get("bilibili:title")).toBe("SESSDATA=abc");
    expect(seenAuth.get("bilibili:rooms")).toBe("SESSDATA=abc");
    expect(seenAuth.get("bilibili:stream")).toBe("SESSDATA=abc");
  });

  it("uses built-in platform adapters for Huya and Bilibili anchors", async () => {
    const originalFetch = globalThis.fetch;
    const huyaHtml = `
      <title>IEM Cologne_虎牙CS2赛事_CS2直播_虎牙直播</title>
      <script>var hyPlayerConfig = { stream: {"data":[{"gameLiveInfo":{"profileRoom":825801,"roomName":"IEM Cologne 纯净流"},"gameStreamInfoList":[{"sStreamName":"huya-stream","sFlvUrl":"http://al.flv.huya.com/src","sFlvUrlSuffix":"flv","sFlvAntiCode":"wsSecret=1"}]}]} };</script>`;
    const biliHtml = "<title>IEM Cologne Major</title>";
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("huya.com")) {
        return new Response(huyaHtml, { status: 200 });
      }

      if (url.includes("api.live.bilibili.com")) {
        return Response.json({
          code: 0,
          data: {
            live_status: 1,
            playurl_info: {
              playurl: {
                stream: [
                  {
                    format: [
                      {
                        format_name: "flv",
                        codec: [
                          {
                            current_qn: 250,
                            base_url: "/live-bvc/bili.flv?",
                            url_info: [{ host: "https://bili.example", extra: "sign=1" }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
        });
      }

      if (url.includes("bili.example")) {
        return new Response("", { status: 200, headers: { "content-type": "video/x-flv" } });
      }

      if (url.includes("live.bilibili.com")) {
        return new Response(biliHtml, { status: 200 });
      }

      return new Response("", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const result = await runResolver({
        anchors: ["https://www.huya.com/825801", "https://live.bilibili.com/35"],
        outputDir: mkdtempSync(join(tmpdir(), "cs2stream-default-adapters-")),
        cleanStreamFilter: "all",
      });

      expect(result.ok).toBe(true);
      expect(result.rooms.map((room) => room.platform)).toEqual(["huya", "bilibili"]);
      expect(result.rooms.filter((room) => room.ok).map((room) => room.stream?.url)).toEqual([
        "http://al.flv.huya.com/src/huya-stream.flv?wsSecret=1",
      ]);
      expect(result.rooms.find((room) => room.platform === "bilibili")?.error?.code).toBe("auth_required");
    } finally {
      vi.unstubAllGlobals();
      globalThis.fetch = originalFetch;
    }
  });

  it("returns a structured failure when playlist writing fails", async () => {
    const outputFile = join(mkdtempSync(join(tmpdir(), "douyu-cs2-")), "not-a-directory");
    closeSync(openSync(outputFile, "w"));

    const result = await runResolver({
      anchor: "https://www.douyu.com/601514",
      outputDir: outputFile,
      adapters: [resolvingAdapter],
    });

    expect(result.ok).toBe(false);
    expect(result.eventTitle).toBe("科隆MAJOR");
    expect(result.rooms.some((room) => room.ok)).toBe(true);
    expect(result.errors[0]?.code).toBe("playlist_write_failed");
  });

  it("limits concurrent stream resolution calls", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const rooms = Array.from({ length: 6 }, (_, index) => ({
      platform: "douyu" as const,
      roomId: `${index + 1}`,
      roomUrl: `https://www.douyu.com/${index + 1}`,
      label: `room ${index + 1}`,
    }));
    const adapter: PlatformAdapter = {
      ...resolvingAdapter,
      discoverEventRooms: async () => rooms,
      resolveStream: async (room) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return [{ url: `https://stream.example/${room.roomId}.flv`, format: "flv" }];
      },
    };

    const result = await runResolver({
      anchor: "https://www.douyu.com/601514",
      outputDir: mkdtempSync(join(tmpdir(), "douyu-cs2-")),
      streamConcurrency: 2,
      cleanStreamFilter: "all",
      adapters: [adapter],
    });

    expect(result.ok).toBe(true);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it("uses safe concurrency when streamConcurrency is NaN", async () => {
    const result = await runResolver({
      anchor: "https://www.douyu.com/601514",
      outputDir: mkdtempSync(join(tmpdir(), "douyu-cs2-")),
      streamConcurrency: Number.NaN,
      cleanStreamFilter: "all",
      adapters: [multiRoomAdapter()],
    });

    expect(result.ok).toBe(true);
    expect(result.rooms).toHaveLength(3);
    expect(result.rooms.every((room) => room?.ok)).toBe(true);
  });

  it("uses safe concurrency when streamConcurrency is zero", async () => {
    const result = await runResolver({
      anchor: "https://www.douyu.com/601514",
      outputDir: mkdtempSync(join(tmpdir(), "douyu-cs2-")),
      streamConcurrency: 0,
      cleanStreamFilter: "all",
      adapters: [multiRoomAdapter()],
    });

    expect(result.ok).toBe(true);
    expect(result.rooms).toHaveLength(3);
    expect(result.rooms.every((room) => room?.ok)).toBe(true);
  });

  it("uses safe concurrency when streamConcurrency is undefined", async () => {
    const result = await runResolver({
      anchor: "https://www.douyu.com/601514",
      outputDir: mkdtempSync(join(tmpdir(), "douyu-cs2-")),
      streamConcurrency: undefined,
      cleanStreamFilter: "all",
      adapters: [multiRoomAdapter()],
    });

    expect(result.ok).toBe(true);
    expect(result.rooms).toHaveLength(3);
    expect(result.rooms.every((room) => room?.ok)).toBe(true);
  });

  it("uses safe concurrency when streamConcurrency is negative", async () => {
    const result = await runResolver({
      anchor: "https://www.douyu.com/601514",
      outputDir: mkdtempSync(join(tmpdir(), "douyu-cs2-")),
      streamConcurrency: -1,
      cleanStreamFilter: "all",
      adapters: [multiRoomAdapter()],
    });

    expect(result.ok).toBe(true);
    expect(result.rooms).toHaveLength(3);
    expect(result.rooms.every((room) => room?.ok)).toBe(true);
  });
});

function multiRoomAdapter(): PlatformAdapter {
  return {
    ...resolvingAdapter,
    discoverEventRooms: async () => [
      { platform: "douyu", roomId: "1", roomUrl: "https://www.douyu.com/1", label: "room 1" },
      { platform: "douyu", roomId: "2", roomUrl: "https://www.douyu.com/2", label: "room 2" },
      { platform: "douyu", roomId: "3", roomUrl: "https://www.douyu.com/3", label: "room 3" },
    ],
    resolveStream: async (room) => [{ url: `https://stream.example/${room.roomId}.flv`, format: "flv" }],
  };
}
