import { describe, expect, it } from "vitest";
import { resolveDouyuStreamFromApiPayload } from "../src/platforms/douyu/stream.js";

describe("resolveDouyuStreamFromApiPayload", () => {
  it("returns a FLV candidate from a direct rtmp_url and rtmp_live payload", () => {
    expect(
      resolveDouyuStreamFromApiPayload({
        rtmp_url: "https://example.douyucdn.cn/live",
        rtmp_live: "601514abc.flv",
        rate: 0,
      })
    ).toEqual([{ url: "https://example.douyucdn.cn/live/601514abc.flv", format: "flv", quality: "best" }]);
  });

  it("marks cookie-bound streams as requiring authentication", () => {
    expect(
      resolveDouyuStreamFromApiPayload({
        url: "https://example.douyucdn.cn/live/auth.flv",
        requiresAuth: true,
      })
    ).toEqual([{ url: "https://example.douyucdn.cn/live/auth.flv", format: "flv", requiresAuth: true }]);
  });

  it("returns no candidates for empty payloads", () => {
    expect(resolveDouyuStreamFromApiPayload({})).toEqual([]);
  });
});
