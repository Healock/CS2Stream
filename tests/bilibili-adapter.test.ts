import { describe, expect, it, vi } from "vitest";
import { createBilibiliAdapter, normalizeBilibiliAnchor } from "../src/platforms/bilibili/adapter.js";
import type { PlatformContext } from "../src/platforms/types.js";

const context: PlatformContext = { auth: { source: "none" }, timeoutMs: 1000 };

describe("Bilibili adapter", () => {
  it("detects and normalizes Bilibili live room URLs without accepting bare numeric IDs", () => {
    const adapter = createBilibiliAdapter({ fetchHtml: async () => "", fetchRoomPlayInfo: async () => ({ code: 0, data: {} }) });

    expect(adapter.detect("https://live.bilibili.com/35")).toBe(true);
    expect(adapter.detect("https://live.bilibili.com/35?spm_id=x#frag")).toBe(true);
    expect(adapter.detect("35")).toBe(false);
    expect(adapter.detect("https://www.douyu.com/601514")).toBe(false);
    expect(normalizeBilibiliAnchor("http://live.bilibili.com/35?x=1#frag")).toBe("https://live.bilibili.com/35");
  });

  it("uses page title for the event title and exposes the configured live room", async () => {
    const fetchHtml = vi.fn(async () => "<html><head><title>IEM Cologne Major</title></head></html>");
    const adapter = createBilibiliAdapter({ fetchHtml, fetchRoomPlayInfo: async () => ({ code: 0, data: {} }) });

    await expect(adapter.getEventTitle("https://live.bilibili.com/35", context)).resolves.toBe("IEM Cologne Major");
    await expect(adapter.discoverEventRooms("https://live.bilibili.com/35", context)).resolves.toEqual([
      {
        platform: "bilibili",
        roomId: "35",
        roomUrl: "https://live.bilibili.com/35",
        label: "IEM Cologne Major",
      },
    ]);
  });

  it("resolves playable FLV and HLS candidates from getRoomPlayInfo", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async () => new Response("", { status: 200, headers: { "content-type": "video/x-flv" } }));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createBilibiliAdapter({
      fetchHtml: async () => "<title>IEM Cologne Major</title>",
      fetchRoomPlayInfo: async () => ({
        code: 0,
        data: {
          live_status: 1,
          playurl_info: {
            playurl: {
              stream: [
                {
                  protocol_name: "http_stream",
                  format: [
                    {
                      format_name: "flv",
                      codec: [
                        {
                          current_qn: 250,
                          base_url: "/live-bvc/live_35.flv?",
                          url_info: [{ host: "https://example.bilivideo.com", extra: "expires=1&sign=abc" }],
                        },
                      ],
                    },
                  ],
                },
                {
                  protocol_name: "http_hls",
                  format: [
                    {
                      format_name: "ts",
                      codec: [
                        {
                          current_qn: 250,
                          base_url: "/live-bvc/live_35/index.m3u8?",
                          url_info: [{ host: "https://hls.example.bilivideo.com", extra: "expires=1&sign=hls" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
      }),
    });

    try {
      await expect(
        adapter.resolveStream(
          { platform: "bilibili", roomId: "35", roomUrl: "https://live.bilibili.com/35", label: "IEM Cologne Major" },
          context
        )
      ).resolves.toEqual([
        {
          url: "https://example.bilivideo.com/live-bvc/live_35.flv?expires=1&sign=abc",
          format: "flv",
          quality: "250",
          requiresAuth: true,
        },
        {
          url: "https://hls.example.bilivideo.com/live-bvc/live_35/index.m3u8?expires=1&sign=hls",
          format: "hls",
          quality: "250",
          requiresAuth: true,
        },
      ]);
    } finally {
      vi.unstubAllGlobals();
      globalThis.fetch = originalFetch;
    }
  });

  it("moves Bilibili candidates that pass a bare media probe to the front", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("blocked.example")) {
        return new Response("", { status: 403, headers: { "content-type": "video/x-flv" } });
      }

      if (url.includes("open.example")) {
        return new Response("", { status: 206, headers: { "content-type": "video/x-flv" } });
      }

      return new Response("", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createBilibiliAdapter({
      fetchHtml: async () => "<title>IEM Cologne Major</title>",
      fetchRoomPlayInfo: async () => ({
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
                          base_url: "/blocked.flv?",
                          url_info: [{ host: "https://blocked.example", extra: "sign=1" }],
                        },
                        {
                          current_qn: 250,
                          base_url: "/open.flv?",
                          url_info: [{ host: "https://open.example", extra: "sign=2" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
      }),
    });

    try {
      const candidates = await adapter.resolveStream(
        { platform: "bilibili", roomId: "35", roomUrl: "https://live.bilibili.com/35", label: "IEM Cologne Major" },
        context
      );

      expect(candidates).toEqual([
        {
          url: "https://open.example/open.flv?sign=2",
          format: "flv",
          quality: "250",
          requiresAuth: true,
        },
      ]);
    } finally {
      vi.unstubAllGlobals();
      globalThis.fetch = originalFetch;
    }
  });

  it("returns no Bilibili candidates when every media URL requires request headers", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async () => new Response("", { status: 403, headers: { "content-type": "video/x-flv" } }));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createBilibiliAdapter({
      fetchHtml: async () => "<title>IEM Cologne Major</title>",
      fetchRoomPlayInfo: async () => ({
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
                          base_url: "/blocked.flv?",
                          url_info: [{ host: "https://blocked.example", extra: "sign=1" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
      }),
    });

    try {
      await expect(
        adapter.resolveStream(
          { platform: "bilibili", roomId: "35", roomUrl: "https://live.bilibili.com/35", label: "IEM Cologne Major" },
          context
        )
      ).resolves.toEqual([]);
    } finally {
      vi.unstubAllGlobals();
      globalThis.fetch = originalFetch;
    }
  });

  it("requests Bilibili play info with ptype=8 for web-playable CDN candidates", async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async () => Response.json({ code: 0, data: { live_status: 0 } }));
    vi.stubGlobal("fetch", fetchMock);

    try {
      const adapter = createBilibiliAdapter({ fetchHtml: async () => "<title>IEM Cologne Major</title>" });

      await adapter.resolveStream(
        { platform: "bilibili", roomId: "35", roomUrl: "https://live.bilibili.com/35", label: "IEM Cologne Major" },
        context
      );

      const requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
      expect(requestedUrl).toContain("ptype=8");
    } finally {
      vi.unstubAllGlobals();
      globalThis.fetch = originalFetch;
    }
  });

  it("returns no stream candidates when the Bilibili room is offline", async () => {
    const adapter = createBilibiliAdapter({
      fetchHtml: async () => "<title>IEM Cologne Major</title>",
      fetchRoomPlayInfo: async () => ({ code: 0, data: { live_status: 0 } }),
    });

    await expect(
      adapter.resolveStream(
        { platform: "bilibili", roomId: "35", roomUrl: "https://live.bilibili.com/35", label: "IEM Cologne Major" },
        context
      )
    ).resolves.toEqual([]);
  });
});
