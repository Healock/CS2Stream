import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDouyuHtml, normalizeDouyuFetchUrl, renderDouyuHtml } from "../src/platforms/douyu/page.js";

describe("Douyu page fetch boundary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock("playwright");
  });

  it("normalizes fetch URLs to HTTPS Douyu room pages without query or hash", () => {
    expect(normalizeDouyuFetchUrl("http://www.douyu.com/601514?dyshid=x#frag")).toBe(
      "https://www.douyu.com/601514"
    );
  });

  it("rejects hostile hosts before calling fetch with cookies", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await expect(
      fetchDouyuHtml("https://evil.example/601514", { source: "cookie-file", cookieHeader: "a=b" }, 1000)
    ).rejects.toThrow(/Invalid Douyu fetch host/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns rendered content instead of throwing when the switch-room element is not visible", async () => {
    const close = vi.fn(async () => undefined);
    const content = vi.fn(async () => '<div class="wm-pc-switchroom"></div>');
    const waitForSelector = vi.fn(async () => {
      throw new Error("page.waitForSelector: Timeout 15000ms exceeded");
    });
    const goto = vi.fn(async () => undefined);
    const newPage = vi.fn(async () => ({ goto, waitForSelector, content }));
    const launch = vi.fn(async () => ({ newPage, close }));
    vi.doMock("playwright", () => ({ chromium: { launch } }));

    await expect(renderDouyuHtml("https://www.douyu.com/601514", 1000)).resolves.toBe(
      '<div class="wm-pc-switchroom"></div>'
    );
    expect(waitForSelector).toHaveBeenCalledWith(".wm-pc-switchroom", { state: "attached", timeout: 1000 });
    expect(close).toHaveBeenCalled();
  });
});
