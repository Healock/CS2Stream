import { describe, expect, it } from "vitest";
import type { PlatformAdapter } from "../src/platforms/types.js";
import { findPlatformAdapter } from "../src/platforms/registry.js";

const douyuAdapter: PlatformAdapter = {
  id: "douyu",
  detect: (input) => input.includes("douyu.com") || /^\d+$/.test(input),
  discoverEventRooms: async () => [],
  getEventTitle: async () => "绉戦殕MAJOR",
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
