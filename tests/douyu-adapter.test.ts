import { describe, expect, it, vi } from "vitest";
import { createDouyuAdapter, normalizeDouyuAnchor } from "../src/platforms/douyu/adapter.js";
import type { PlatformContext } from "../src/platforms/types.js";

const context: PlatformContext = { auth: { source: "none" }, timeoutMs: 1000 };

describe("Douyu adapter", () => {
  it("detects Douyu URLs and numeric room IDs", () => {
    const adapter = createDouyuAdapter({ fetchHtml: async () => "" });

    expect(adapter.detect("https://www.douyu.com/601514")).toBe(true);
    expect(adapter.detect("https://www.douyu.com/601514?dyshid=x#frag")).toBe(true);
    expect(adapter.detect("http://www.douyu.com/601514")).toBe(true);
    expect(adapter.detect("601514")).toBe(true);
    expect(adapter.detect("https://example.com/601514")).toBe(false);
    expect(adapter.detect("https://evil.example/?next=douyu.com")).toBe(false);
    expect(adapter.detect("https://notdouyu.com/601514")).toBe(false);
  });

  it("normalizes only valid Douyu anchors", () => {
    expect(normalizeDouyuAnchor("601514")).toBe("https://www.douyu.com/601514");
    expect(normalizeDouyuAnchor("https://www.douyu.com/601514?dyshid=x")).toBe(
      "https://www.douyu.com/601514"
    );
    expect(normalizeDouyuAnchor("http://www.douyu.com/601514?dyshid=x#frag")).toBe(
      "https://www.douyu.com/601514"
    );
    expect(() => normalizeDouyuAnchor("https://evil.example/?next=douyu.com")).toThrow(
      /Invalid Douyu anchor host/
    );
  });

  it("extracts title and switch-room rooms from fetched HTML", async () => {
    const html = `
      <html>
        <head><title>科隆MAJOR_斗鱼CSGO赛事主频道直播</title></head>
        <body>
          <div class="wm-pc-switchroom">
            <a href="https://www.douyu.com/601514">
              <div class="wm-pc-room-button-text">主舞台纯净流</div>
            </a>
          </div>
        </body>
      </html>`;
    const fetchHtml = vi.fn(async () => html);
    const adapter = createDouyuAdapter({ fetchHtml });

    await expect(adapter.getEventTitle("https://www.douyu.com/601514", context)).resolves.toBe("科隆MAJOR");
    await expect(adapter.discoverEventRooms("https://www.douyu.com/601514", context)).resolves.toEqual([
      {
        platform: "douyu",
        roomId: "601514",
        roomUrl: "https://www.douyu.com/601514",
        label: "主舞台纯净流",
      },
    ]);
  });

  it("uses rendered HTML fallback when fetched HTML has no switch-room rooms", async () => {
    const fetchedHtml = `
      <html>
        <head><title>科隆MAJOR_斗鱼CSGO赛事主频道直播</title></head>
        <body></body>
      </html>`;
    const renderedHtml = `
      <html>
        <body>
          <div class="wm-pc-switchroom">
            <a href="https://www.douyu.com/6979222">
              <div class="wm-pc-room-button-text">玩机器</div>
            </a>
          </div>
        </body>
      </html>`;
    const fetchHtml = vi.fn(async () => fetchedHtml);
    const renderHtml = vi.fn(async () => renderedHtml);
    const adapter = createDouyuAdapter({ fetchHtml, renderHtml });

    await expect(adapter.discoverEventRooms("https://www.douyu.com/601514", context)).resolves.toEqual([
      {
        platform: "douyu",
        roomId: "6979222",
        roomUrl: "https://www.douyu.com/6979222",
        label: "玩机器",
      },
    ]);
    expect(renderHtml).toHaveBeenCalledWith("https://www.douyu.com/601514", context);
  });
});
