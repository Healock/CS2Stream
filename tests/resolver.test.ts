import { mkdtempSync, readFileSync } from "node:fs";
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
});
