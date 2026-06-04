import { describe, expect, it, vi } from "vitest";
import {
  buildDouyuRateRequestBody,
  buildDouyuBrowserCookies,
  preferDouyuStreamPayload,
  resolveDouyuRoomStream,
  resolveDouyuStreamFromApiPayload,
  selectPreferredDouyuRate,
} from "../src/platforms/douyu/stream.js";

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

  it("uses the matching multirate name as the candidate quality label", () => {
    expect(
      resolveDouyuStreamFromApiPayload({
        url: "https://example.douyucdn.cn/live/601514abc.flv",
        rate: 0,
        multirates: [
          { name: "Original 1080P60", rate: 0, bit: 10169 },
          { name: "Blue 4M", rate: 4, bit: 4000 },
        ],
      })
    ).toEqual([
      {
        url: "https://example.douyucdn.cn/live/601514abc.flv",
        format: "flv",
        quality: "Original 1080P60",
      },
    ]);
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

describe("selectPreferredDouyuRate", () => {
  it("prefers the 1080P60 multirate over Douyu's default 4M response", () => {
    expect(
      selectPreferredDouyuRate({
        rate: 4,
        multirates: [
          { name: "Original 1080P60", rate: 0, highBit: 1, bit: 10169 },
          { name: "Blue 4M", rate: 4, highBit: 1, bit: 4000 },
          { name: "HD", rate: 2, highBit: 0, bit: 900 },
        ],
      })
    ).toEqual({ rate: 0, quality: "Original 1080P60" });
  });

  it("recognizes Douyu's Chinese 60 fps quality labels", () => {
    expect(
      selectPreferredDouyuRate({
        rate: 4,
        multirates: [
          { name: "\u539f\u753b60\u5e27", rate: 0, highBit: 1, bit: 10169 },
          { name: "\u84dd\u51494M", rate: 4, highBit: 1, bit: 4000 },
        ],
      })
    ).toEqual({ rate: 0, quality: "\u539f\u753b60\u5e27" });
  });

  it("falls back to original quality when no 60 fps entry is advertised", () => {
    expect(
      selectPreferredDouyuRate({
        rate: 4,
        multirates: [
          { name: "Blue 4M", rate: 4, highBit: 1, bit: 4000 },
          { name: "HD", rate: 2, highBit: 0, bit: 900 },
        ],
      })
    ).toBeUndefined();
  });
});

describe("preferDouyuStreamPayload", () => {
  it("replays the captured request at the preferred rate and keeps the playable replay payload", async () => {
    const replayRate = vi.fn(async (rate: number) => ({
      url: `https://example.douyucdn.cn/live/high-${rate}.flv`,
      rate,
      multirates: [
        { name: "Original 1080P60", rate: 0, highBit: 1, bit: 10169 },
        { name: "Blue 4M", rate: 4, highBit: 1, bit: 4000 },
      ],
    }));

    await expect(
      preferDouyuStreamPayload(
        {
          url: "https://example.douyucdn.cn/live/low.flv",
          rate: 4,
          multirates: [
            { name: "Original 1080P60", rate: 0, highBit: 1, bit: 10169 },
            { name: "Blue 4M", rate: 4, highBit: 1, bit: 4000 },
          ],
        },
        replayRate
      )
    ).resolves.toMatchObject({ url: "https://example.douyucdn.cn/live/high-0.flv", rate: 0 });
    expect(replayRate).toHaveBeenCalledWith(0);
  });

  it("keeps the initial playable payload when the preferred-rate replay is not playable", async () => {
    const initialPayload = {
      url: "https://example.douyucdn.cn/live/low.flv",
      rate: 4,
      multirates: [
        { name: "Original 1080P60", rate: 0, highBit: 1, bit: 10169 },
        { name: "Blue 4M", rate: 4, highBit: 1, bit: 4000 },
      ],
    };

    await expect(preferDouyuStreamPayload(initialPayload, async () => ({ rate: 0 }))).resolves.toBe(initialPayload);
  });
});

describe("buildDouyuRateRequestBody", () => {
  it("rewrites the captured getH5PlayV1 POST body to the selected rate", () => {
    expect(buildDouyuRateRequestBody("enc_data=abc&tt=123&rate=-1&hevc=1", 0)).toBe(
      "enc_data=abc&tt=123&rate=0&hevc=1"
    );
  });

  it("preserves the captured POST body's existing encoding while changing only rate", () => {
    expect(buildDouyuRateRequestBody("enc_data=a%20b%2Bc&rate=-1&tt=123", 0)).toBe(
      "enc_data=a%20b%2Bc&rate=0&tt=123"
    );
  });

  it("appends rate when the captured POST body does not include it", () => {
    expect(buildDouyuRateRequestBody("enc_data=abc&tt=123", 0)).toBe("enc_data=abc&tt=123&rate=0");
  });
});

describe("buildDouyuBrowserCookies", () => {
  it("converts a captured Cookie header into Douyu browser-context cookies", () => {
    expect(buildDouyuBrowserCookies("acf_auth=token; dy_did=device%3D1")).toEqual([
      { name: "acf_auth", value: "token", url: "https://www.douyu.com" },
      { name: "dy_did", value: "device%3D1", url: "https://www.douyu.com" },
    ]);
  });
});
