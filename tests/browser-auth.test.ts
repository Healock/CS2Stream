import { describe, expect, it, vi } from "vitest";
import { capturePlatformBrowserCookies, getPlatformLoginUrl } from "../src/browser-auth.js";

describe("browser auth", () => {
  it("exposes platform login URLs for manual browser authentication", () => {
    expect(getPlatformLoginUrl("douyu")).toBe("https://www.douyu.com/601514");
    expect(getPlatformLoginUrl("huya")).toBe("https://www.huya.com/eslcs");
    expect(getPlatformLoginUrl("bilibili")).toBe("https://live.bilibili.com/35");
  });

  it("captures platform cookies from a real browser session and formats a Cookie header", async () => {
    const close = vi.fn();
    const goto = vi.fn();
    const waitForTimeout = vi.fn();
    const cookies = vi.fn().mockResolvedValue([
      { name: "SESSDATA", value: "abc" },
      { name: "bili_jct", value: "def" },
    ]);
    const newPage = vi.fn().mockResolvedValue({ goto, waitForTimeout });
    const newContext = vi.fn().mockResolvedValue({ newPage, cookies });
    const launchPersistentContext = vi.fn();
    const launch = vi.fn().mockResolvedValue({ newContext, close });

    const cookieHeader = await capturePlatformBrowserCookies("bilibili", {
      chromium: { launch, launchPersistentContext },
      waitMs: 25,
    });

    expect(launch).toHaveBeenCalledWith(expect.objectContaining({ headless: false }));
    expect(goto).toHaveBeenCalledWith("https://live.bilibili.com/35", { waitUntil: "domcontentloaded" });
    expect(waitForTimeout).toHaveBeenCalledWith(25);
    expect(cookies).toHaveBeenCalledWith(["https://live.bilibili.com"]);
    expect(close).toHaveBeenCalled();
    expect(cookieHeader).toBe("SESSDATA=abc; bili_jct=def");
  });

  it("rejects browser authentication when no usable cookies are captured", async () => {
    const close = vi.fn();
    const goto = vi.fn();
    const waitForTimeout = vi.fn();
    const cookies = vi.fn().mockResolvedValue([{ name: "", value: "ignored" }]);
    const newPage = vi.fn().mockResolvedValue({ goto, waitForTimeout });
    const newContext = vi.fn().mockResolvedValue({ newPage, cookies });
    const launchPersistentContext = vi.fn();
    const launch = vi.fn().mockResolvedValue({ newContext, close });

    await expect(
      capturePlatformBrowserCookies("bilibili", {
        chromium: { launch, launchPersistentContext },
        waitMs: 10,
      })
    ).rejects.toThrow(/No usable Bilibili cookies were captured/);
    expect(close).toHaveBeenCalled();
  });

  it("launches with a configured browser executable when one is available", async () => {
    const close = vi.fn();
    const goto = vi.fn();
    const waitForTimeout = vi.fn();
    const cookies = vi.fn().mockResolvedValue([{ name: "acf_auth", value: "token" }]);
    const newPage = vi.fn().mockResolvedValue({ goto, waitForTimeout });
    const newContext = vi.fn().mockResolvedValue({ newPage, cookies });
    const launchPersistentContext = vi.fn();
    const launch = vi.fn().mockResolvedValue({ newContext, close });

    await capturePlatformBrowserCookies("douyu", {
      chromium: { launch, launchPersistentContext },
      browserExecutablePath: "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      waitMs: 10,
    });

    expect(launch).toHaveBeenCalledWith({
      headless: false,
      executablePath: "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    });
  });

  it("can reuse a configured persistent browser profile when provided", async () => {
    const close = vi.fn();
    const goto = vi.fn();
    const waitForTimeout = vi.fn();
    const cookies = vi.fn().mockResolvedValue([{ name: "acf_auth", value: "token" }]);
    const newPage = vi.fn().mockResolvedValue({ goto, waitForTimeout });
    const launchPersistentContext = vi.fn().mockResolvedValue({ newPage, cookies, close });
    const launch = vi.fn();

    const cookieHeader = await capturePlatformBrowserCookies("douyu", {
      chromium: { launch, launchPersistentContext },
      userDataDir: "D:\\BrowserProfiles\\CS2Stream",
      waitMs: 10,
    });

    expect(launchPersistentContext).toHaveBeenCalledWith("D:\\BrowserProfiles\\CS2Stream", expect.objectContaining({ headless: false }));
    expect(launch).not.toHaveBeenCalled();
    expect(cookieHeader).toBe("acf_auth=token");
  });

});
