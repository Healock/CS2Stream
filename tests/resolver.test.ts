import { closeSync, mkdtempSync, openSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
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
