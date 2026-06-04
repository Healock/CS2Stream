import { describe, expect, test, vi } from "vitest";
import { DEFAULT_ANCHORS } from "../src/config.js";
import { createPiTuiApp } from "../src/pi-tui-app.js";
import type { ResolverResult } from "../src/types.js";

const defaultAnchors = [...DEFAULT_ANCHORS];

describe("pi-tui app", () => {
  test("renders title art, boxed status, and directional menu without a single entry URL", () => {
    const app = createPiTuiApp({ exit: vi.fn(), resolve: vi.fn(), openPlaylist: vi.fn() });

    const output = app.render(120).join("\n");

    expect(output).toContain("CS2Stream");
    expect(output).toContain("┌ CS2Stream");
    expect(output).toContain("Platforms: Douyu, Huya, Bilibili");
    expect(output).not.toContain("Entry: https://www.douyu.com/601514");
    expect(output).toContain("→ Resolve CS2 streams and open in PotPlayer");
    expect(output).toContain("Use ↑/↓ or j/k to move");
  });

  test("uses arrow-key navigation and enter to select resolve-only", async () => {
    const result: ResolverResult = { ok: true, eventTitle: "Test Major", playlistPath: "out\\test.dpl", rooms: [], errors: [] };
    const resolve = vi.fn().mockResolvedValue(result);
    const app = createPiTuiApp({ exit: vi.fn(), resolve, openPlaylist: vi.fn() });

    app.handleInput("\x1b[B");
    app.handleInput("\r");
    await app.flush();

    expect(resolve).toHaveBeenCalledWith({ anchors: defaultAnchors, outputDir: "out", cleanStreamFilter: "clean-only" });
    expect(app.render(120).join("\n")).toContain("Resolve complete");
  });

  test("requests a render after async resolve completes", async () => {
    const result: ResolverResult = { ok: true, eventTitle: "Test Major", playlistPath: "out\\test.dpl", rooms: [], errors: [] };
    const requestRender = vi.fn();
    const app = createPiTuiApp({ exit: vi.fn(), resolve: vi.fn().mockResolvedValue(result), openPlaylist: vi.fn(), requestRender });

    app.handleInput("\x1b[B");
    app.handleInput("\r");
    await app.flush();

    expect(requestRender).toHaveBeenCalled();
  });

  test("edits PotPlayer path from the settings menu with vim-style insert and save", () => {
    const app = createPiTuiApp({ exit: vi.fn(), resolve: vi.fn(), openPlaylist: vi.fn() });

    app.handleInput("4");
    app.handleInput("\x1b[B");
    app.handleInput("\x1b[B");
    app.handleInput("\r");
    app.handleInput("i");
    for (const char of "C:\\Tools\\PotPlayerMini64.exe") {
      app.handleInput(char);
    }
    app.handleInput("\x1b");
    app.handleInput(":");
    app.handleInput("w");
    app.handleInput("\r");

    const output = app.render(120).join("\n");
    expect(output).toContain("PotPlayer: C:\\Tools\\PotPlayerMini64.exe");
    expect(output).toContain("PotPlayer path saved.");
  });

  test("toggles Bilibili off from the platform settings view", async () => {
    const result: ResolverResult = { ok: true, eventTitle: "Test Major", playlistPath: "out\\test.dpl", rooms: [], errors: [] };
    const resolve = vi.fn().mockResolvedValue(result);
    const app = createPiTuiApp({ exit: vi.fn(), resolve, openPlaylist: vi.fn() });

    app.handleInput("5");
    expect(app.render(120).join("\n")).toContain("→ [x] Douyu");

    app.handleInput("\x1b[B");
    app.handleInput("\x1b[B");
    app.handleInput("\r");
    expect(app.render(120).join("\n")).toContain("[ ] Bilibili");

    app.handleInput("\x1b");
    app.handleInput("\x1b[B");
    app.handleInput("\r");
    await app.flush();

    expect(resolve).toHaveBeenCalledWith({
      anchors: defaultAnchors.filter((anchor) => !anchor.includes("bilibili")),
      outputDir: "out",
      cleanStreamFilter: "clean-only",
    });
  });

  test("edits platform entries from the pi-tui platform settings view", async () => {
    const result: ResolverResult = { ok: true, eventTitle: "Test Major", playlistPath: "out\\test.dpl", rooms: [], errors: [] };
    const resolve = vi.fn().mockResolvedValue(result);
    const app = createPiTuiApp({ exit: vi.fn(), resolve, openPlaylist: vi.fn() });

    app.handleInput("5");
    for (let index = 0; index < 3; index += 1) {
      app.handleInput("\x1b[B");
    }
    app.handleInput("\r");
    for (let index = 0; index < "https://www.douyu.com/601514".length; index += 1) {
      app.handleInput("x");
    }
    app.handleInput("i");
    for (const char of "https://www.douyu.com/999999") {
      app.handleInput(char);
    }
    app.handleInput("\x1b");
    app.handleInput(":");
    app.handleInput("w");
    app.handleInput("\r");

    const output = app.render(120).join("\n");
    expect(output).toContain("https://www.douyu.com/999999");

    app.handleInput("\x1b");
    app.handleInput("\x1b[B");
    app.handleInput("\r");
    await app.flush();

    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({
      anchors: [
        "https://www.douyu.com/999999",
        "https://www.huya.com/eslcs",
        "https://www.huya.com/eslcsgo2",
        "https://www.huya.com/825801",
        "https://www.huya.com/825802",
        "https://live.bilibili.com/35",
      ],
    }));
  });

  test("captures platform cookies from the pi-tui account authentication menu", async () => {
    const result: ResolverResult = { ok: true, eventTitle: "Test Major", playlistPath: "out\\test.dpl", rooms: [], errors: [] };
    const resolve = vi.fn().mockResolvedValue(result);
    const captureBrowserCookies = vi.fn().mockResolvedValue("SESSDATA=abc");
    const app = createPiTuiApp({
      exit: vi.fn(),
      resolve,
      openPlaylist: vi.fn(),
      captureBrowserCookies,
    });

    app.handleInput("4");
    app.handleInput("\x1b[B");
    app.handleInput("\x1b[B");
    app.handleInput("\x1b[B");
    app.handleInput("\r");
    expect(app.render(120).join("\n")).toContain("Select platform login");

    app.handleInput("\r");
    await app.flush();

    expect(captureBrowserCookies).toHaveBeenCalledWith("bilibili");
    expect(app.render(120).join("\n")).toContain("Bilibili browser cookies captured.");

    app.handleInput("\x1b");
    app.handleInput("\x1b");
    app.handleInput("\x1b[B");
    app.handleInput("\r");
    await app.flush();

    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({
      platformCookieHeaders: { bilibili: "SESSDATA=abc" },
    }));
  });

  test("shows browser auth failures inside pi-tui instead of throwing", async () => {
    const captureBrowserCookies = vi.fn().mockRejectedValue(new Error("missing browser"));
    const app = createPiTuiApp({
      exit: vi.fn(),
      resolve: vi.fn(),
      openPlaylist: vi.fn(),
      captureBrowserCookies,
    });

    app.handleInput("4");
    app.handleInput("\x1b[B");
    app.handleInput("\x1b[B");
    app.handleInput("\x1b[B");
    app.handleInput("\r");
    app.handleInput("\r");
    await app.flush();

    const output = app.render(120).join("\n");
    expect(output).toContain("Browser login failed: missing browser");
    expect(output).toContain("set CS2STREAM_BROWSER_PATH");
  });

  test("switches language from the pi-tui language menu", () => {
    const app = createPiTuiApp({ exit: vi.fn(), resolve: vi.fn(), openPlaylist: vi.fn() });

    app.handleInput("6");
    expect(app.render(120).join("\n")).toContain("→ English  Current");

    app.handleInput("\x1b[A");
    app.handleInput("\r");
    const chineseOutput = app.render(120).join("\n");
    expect(chineseOutput).toContain("语言已切换为中文。");
    expect(chineseOutput).toContain("→ 获取 CS2 赛事流并打开 PotPlayer");
    expect(chineseOutput).toContain("语言  当前: 中文");

    app.handleInput("6");
    app.handleInput("\x1b[B");
    app.handleInput("\r");
    const englishOutput = app.render(120).join("\n");
    expect(englishOutput).toContain("Language switched to English.");
    expect(englishOutput).toContain("→ Resolve CS2 streams and open in PotPlayer");
  });
});
