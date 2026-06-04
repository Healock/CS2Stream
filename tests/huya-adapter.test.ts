import { describe, expect, it, vi } from "vitest";
import { createHuyaAdapter, normalizeHuyaAnchor } from "../src/platforms/huya/adapter.js";
import type { PlatformContext } from "../src/platforms/types.js";

const context: PlatformContext = { auth: { source: "none" }, timeoutMs: 1000 };

const liveHtml = `
  <html>
    <head><title>IEM Cologne_Huya CS2 event</title></head>
    <body>
      <script>
        var hyPlayerConfig = {
          html5: 1,
          stream: {"data":[{"gameLiveInfo":{"profileRoom":825801,"roomName":"IEM Cologne clean","gameFullName":"CS2","liveSourceType":12},"gameStreamInfoList":[{"lPresenterUid":"12345","sFlvUrl":"http://al.flv.huya.com/src","sStreamName":"stream-name","sFlvUrlSuffix":"flv","sFlvAntiCode":"wsSecret=flv-secret&wsTime=abc","sHlsUrl":"http://al.hls.huya.com/src","sHlsUrlSuffix":"m3u8","sHlsAntiCode":"wsSecret=hls-secret&wsTime=abc"}]}]}
        };
      </script>
    </body>
  </html>`;

describe("Huya adapter", () => {
  it("detects and normalizes Huya room URLs without accepting bare numeric IDs", () => {
    const adapter = createHuyaAdapter({ fetchHtml: async () => "" });

    expect(adapter.detect("https://www.huya.com/eslcsgo2")).toBe(true);
    expect(adapter.detect("https://www.huya.com/825801?x=1#top")).toBe(true);
    expect(adapter.detect("825801")).toBe(false);
    expect(adapter.detect("https://www.douyu.com/601514")).toBe(false);
    expect(normalizeHuyaAnchor("http://www.huya.com/825801?x=1#top")).toBe("https://www.huya.com/825801");
  });

  it("extracts event title and a single room from the Huya page stream data", async () => {
    const fetchHtml = vi.fn(async () => liveHtml);
    const adapter = createHuyaAdapter({ fetchHtml });

    await expect(adapter.getEventTitle("https://www.huya.com/825801", context)).resolves.toBe("IEM Cologne clean");
    await expect(adapter.discoverEventRooms("https://www.huya.com/825801", context)).resolves.toEqual([
      {
        platform: "huya",
        roomId: "825801",
        roomUrl: "https://www.huya.com/825801",
        label: "IEM Cologne clean",
      },
    ]);
  });

  it("uses current Huya live room metadata instead of stale page title text", async () => {
    const staleTitleHtml = liveHtml.replace(
      "<title>IEM Cologne_Huya CS2 event</title>",
      "<title>IEM Rio 2026_ESL赛事_CS2_虎牙直播</title>"
    ).replace(
      '"roomName":"IEM Cologne clean"',
      '"roomName":"IEM科隆Major Stage1"'
    );
    const adapter = createHuyaAdapter({ fetchHtml: async () => staleTitleHtml });

    await expect(adapter.getEventTitle("https://www.huya.com/eslcs", context)).resolves.toBe("IEM科隆Major Stage1");
  });

  it("does not discover a Huya room when the page exposes no live stream list", async () => {
    const noStreamHtml = liveHtml.replace(
      /"gameStreamInfoList":\[[\s\S]*?\]\}\]\}/,
      '"gameStreamInfoList":[]}]}'
    );
    const adapter = createHuyaAdapter({ fetchHtml: async () => noStreamHtml });

    await expect(adapter.discoverEventRooms("https://www.huya.com/eslcsgo2", context)).resolves.toEqual([]);
  });

  it("resolves only FLV and HLS candidates that pass a bare media probe", async () => {
    const adapter = createHuyaAdapter({
      fetchHtml: async () => liveHtml,
      probeMedia: async (url) => url.includes(".flv?"),
    });

    await expect(
      adapter.resolveStream(
        { platform: "huya", roomId: "825801", roomUrl: "https://www.huya.com/825801", label: "IEM Cologne clean" },
        context
      )
    ).resolves.toEqual([
      {
        url: "http://al.flv.huya.com/src/stream-name.flv?wsSecret=flv-secret&wsTime=abc",
        format: "flv",
      },
    ]);
  });

  it("re-signs Huya anti-code fields when the page provides signing inputs", async () => {
    const fm = Buffer.from("test-prefix_extra").toString("base64");
    const signedHtml = `
      <script>
        var hyPlayerConfig = {
          stream: {"data":[{"gameLiveInfo":{"profileRoom":825801,"roomName":"IEM Cologne clean","liveSourceType":8},"gameStreamInfoList":[{"lPresenterUid":"12345","sStreamName":"12345-live","sFlvUrl":"http://al.flv.huya.com/src","sFlvUrlSuffix":"flv","sFlvAntiCode":"wsSecret=raw-secret&wsTime=65&fm=${encodeURIComponent(fm)}&ctype=huya_live&fs=bgct"}]}]}
        };
      </script>`;
    const adapter = createHuyaAdapter({ fetchHtml: async () => signedHtml, probeMedia: async () => true });

    const [candidate] = await adapter.resolveStream(
      { platform: "huya", roomId: "825801", roomUrl: "https://www.huya.com/825801", label: "IEM Cologne clean" },
      context
    );

    expect(candidate.url).toContain("http://al.flv.huya.com/src/12345-live.flv?");
    expect(candidate.url).not.toContain("raw-secret");
    expect(candidate.url).toMatch(/[?&]wsSecret=[0-9a-f]{32}/);
    expect(candidate.url).toContain("&u=");
    expect(candidate.url).toContain("&seqid=");
    expect(candidate.url).toContain("&uuid=");
    expect(candidate.url).toContain("&ver=1");
    expect(candidate.url).toContain("&t=100");
  });

  it("keeps original Huya anti-code as a fallback after signed candidates", async () => {
    const fm = Buffer.from("test-prefix_extra").toString("base64");
    const unsignedHtml = `
      <script>
        var hyPlayerConfig = {
          stream: {"data":[{"gameLiveInfo":{"profileRoom":825801,"roomName":"IEM Cologne clean","liveSourceType":12},"gameStreamInfoList":[{"lPresenterUid":"12345","sStreamName":"12345-live","sFlvUrl":"http://al.flv.huya.com/src","sFlvUrlSuffix":"flv","sFlvAntiCode":"wsSecret=raw-secret&wsTime=65&fm=${encodeURIComponent(fm)}&ctype=huya_live&fs=bgct"}]}]}
        };
      </script>`;
    const adapter = createHuyaAdapter({ fetchHtml: async () => unsignedHtml, probeMedia: async () => true });

    const candidates = await adapter.resolveStream(
      { platform: "huya", roomId: "825801", roomUrl: "https://www.huya.com/825801", label: "IEM Cologne clean" },
      context
    );

    expect(candidates[0].url).not.toContain("raw-secret");
    expect(candidates[0].url).toContain("&u=");
    expect(candidates[0].url).toContain("&seqid=");
    expect(candidates.some((candidate) => candidate.url.includes("wsSecret=raw-secret"))).toBe(true);
  });

  it("returns no stream candidates when every Huya media URL fails the bare probe", async () => {
    const adapter = createHuyaAdapter({ fetchHtml: async () => liveHtml, probeMedia: async () => false });

    await expect(
      adapter.resolveStream(
        { platform: "huya", roomId: "825801", roomUrl: "https://www.huya.com/825801", label: "IEM Cologne clean" },
        context
      )
    ).resolves.toEqual([]);
  });

  it("probes Huya media URLs without browser-origin headers before returning PotPlayer candidates", async () => {
    const originalFetch = globalThis.fetch;
    const seenHeaders: Headers[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      seenHeaders.push(new Headers(init?.headers));
      return new Response("", { status: 200, headers: { "content-type": "video/x-flv" } });
    }));

    try {
      const adapter = createHuyaAdapter({ fetchHtml: async () => liveHtml });

      await adapter.resolveStream(
        { platform: "huya", roomId: "825801", roomUrl: "https://www.huya.com/825801", label: "IEM Cologne clean" },
        context
      );

      expect(seenHeaders.length).toBeGreaterThan(0);
      expect(seenHeaders.every((headers) => !headers.has("Referer") && !headers.has("Origin"))).toBe(true);
    } finally {
      vi.unstubAllGlobals();
      globalThis.fetch = originalFetch;
    }
  });

  it("returns no stream candidates when Huya page has no stream info", async () => {
    const adapter = createHuyaAdapter({ fetchHtml: async () => "<title>Huya live</title>" });

    await expect(
      adapter.resolveStream(
        { platform: "huya", roomId: "825802", roomUrl: "https://www.huya.com/825802", label: "Huya room" },
        context
      )
    ).resolves.toEqual([]);
  });
});
