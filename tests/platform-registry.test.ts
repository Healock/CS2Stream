import { describe, expect, it } from "vitest";
import type { PlatformAdapter } from "../src/platforms/types.js";
import { AmbiguousPlatformError, findPlatformAdapter } from "../src/platforms/registry.js";

const douyuAdapter: PlatformAdapter = {
  id: "douyu",
  detect: (input) => input.includes("douyu.com") || /^\d+$/.test(input),
  discoverEventRooms: async () => [],
  getEventTitle: async () => "绉戦殕MAJOR",
  resolveStream: async () => []
};

const huyaAdapter: PlatformAdapter = {
  id: "huya",
  detect: (input) => /^\d+$/.test(input),
  discoverEventRooms: async () => [],
  getEventTitle: async () => undefined,
  resolveStream: async () => []
};

describe("findPlatformAdapter", () => {
  it("returns the matching adapter", () => {
    expect(findPlatformAdapter("https://www.douyu.com/601514", [douyuAdapter])?.id).toBe("douyu");
  });

  it("returns undefined for unsupported input", () => {
    expect(findPlatformAdapter("https://example.com/room", [douyuAdapter])).toBeUndefined();
  });

  it("throws an explicit ambiguity error when multiple adapters match", () => {
    expect(() => findPlatformAdapter("601514", [douyuAdapter, huyaAdapter])).toThrow(AmbiguousPlatformError);
    expect(() => findPlatformAdapter("601514", [douyuAdapter, huyaAdapter])).toThrow(
      /Ambiguous platform adapter for "601514": douyu, huya/
    );
  });
});
