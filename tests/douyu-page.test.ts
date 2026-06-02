import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDouyuHtml, normalizeDouyuFetchUrl } from "../src/platforms/douyu/page.js";

describe("Douyu page fetch boundary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
});
