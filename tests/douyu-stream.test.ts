import { describe, expect, it } from "vitest";
import { resolveDouyuRoomStream, resolveDouyuStreamFromApiPayload } from "../src/platforms/douyu/stream.js";

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

  it("falls back to rtmp parts when the direct URL is empty", () => {
    expect(
      resolveDouyuStreamFromApiPayload({
        url: "",
        rtmp_url: "https://example.douyucdn.cn/live",
        rtmp_live: "601514abc.flv",
      })
    ).toEqual([{ url: "https://example.douyucdn.cn/live/601514abc.flv", format: "flv" }]);
  });

  it("rejects unsupported stream URL protocols", () => {
    expect(resolveDouyuStreamFromApiPayload({ url: "javascript:alert(1)" })).toEqual([]);
  });

  it("infers unknown format when only the query string contains a known extension", () => {
    expect(
      resolveDouyuStreamFromApiPayload({
        url: "https://example.com/live/no-extension?source=.flv",
      })
    ).toEqual([{ url: "https://example.com/live/no-extension?source=.flv", format: "unknown" }]);
  });

  it("infers HLS format from pathname extension case-insensitively", () => {
    expect(resolveDouyuStreamFromApiPayload({ url: "https://example.com/live/STREAM.M3U8" })).toEqual([
      { url: "https://example.com/live/STREAM.M3U8", format: "hls" },
    ]);
  });

  it("resolves a room stream from captured getH5PlayV1 payload data", async () => {
    await expect(
      resolveDouyuRoomStream(
        {
          platform: "douyu",
          roomId: "601514",
          roomUrl: "https://www.douyu.com/601514",
          label: "主舞台纯净流",
        },
        { auth: { source: "none" }, timeoutMs: 1000 },
        {
          captureStreamPayload: async () => ({
            rtmp_url: "https://stream.example/live",
            rtmp_live: "601514abc.flv",
            rate: 0,
          }),
        }
      )
    ).resolves.toEqual([{ url: "https://stream.example/live/601514abc.flv", format: "flv", quality: "best" }]);
  });

  it("returns no room stream candidates when capture produces no payload", async () => {
    await expect(
      resolveDouyuRoomStream(
        {
          platform: "douyu",
          roomId: "601514",
          roomUrl: "https://www.douyu.com/601514",
          label: "主舞台纯净流",
        },
        { auth: { source: "none" }, timeoutMs: 1000 },
        { captureStreamPayload: async () => undefined }
      )
    ).resolves.toEqual([]);
  });
});
