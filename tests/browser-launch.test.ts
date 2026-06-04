import { describe, expect, it } from "vitest";
import { resolveBrowserExecutablePath, resolveChromiumLaunchOptions } from "../src/browser-launch.js";

describe("browser launch options", () => {
  it("prefers CS2STREAM_BROWSER_PATH before probing installed browsers", () => {
    const browserPath = resolveBrowserExecutablePath({
      env: { CS2STREAM_BROWSER_PATH: "D:\\Portable\\chrome.exe" },
      platform: "win32",
      exists: () => true,
    });

    expect(browserPath).toBe("D:\\Portable\\chrome.exe");
  });

  it("falls back to installed Chrome or Edge locations on Windows", () => {
    const browserPath = resolveBrowserExecutablePath({
      env: {},
      platform: "win32",
      exists: (candidate) => candidate.endsWith("msedge.exe"),
    });

    expect(browserPath).toBe("C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe");
  });

  it("does not hard-code the current Windows user profile in browser probes", () => {
    const probedPaths: string[] = [];

    resolveBrowserExecutablePath({
      env: {},
      platform: "win32",
      exists: (candidate) => {
        probedPaths.push(candidate);
        return false;
      },
    });

    expect(probedPaths.some((candidate) => candidate.includes("\\Administrator\\"))).toBe(false);
  });

  it("builds headless Chromium launch options for resolver browser work", () => {
    expect(
      resolveChromiumLaunchOptions(true, {
        env: { CS2STREAM_BROWSER_PATH: "D:\\Portable\\chrome.exe" },
        platform: "win32",
        exists: () => true,
      })
    ).toEqual({ headless: true, executablePath: "D:\\Portable\\chrome.exe" });
  });
});
