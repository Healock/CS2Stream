import { describe, expect, test, vi } from "vitest";
import { DEFAULT_ANCHORS } from "../src/config.js";
import { runTui } from "../src/tui.js";
import type { ResolverResult } from "../src/types.js";

const defaultAnchors = [...DEFAULT_ANCHORS];

function createIo(answers: string[]) {
  let index = 0;
  let output = "";

  return {
    io: {
      write(chunk: string) {
        output += chunk;
      },
      async question(prompt: string) {
        output += prompt;
        return answers[index++] ?? "0";
      },
      close() {},
    },
    getOutput: () => output,
  };
}

describe("cs2stream TUI", () => {
  test("clears the terminal before drawing each menu when supported", async () => {
    let clearCount = 0;
    const { io } = createIo(["9", "1", "0"]);

    await runTui({
      io: {
        ...io,
        clear() {
          clearCount += 1;
        },
      },
      resolve: vi.fn(),
      openPlaylist: vi.fn(),
    });

    expect(clearCount).toBeGreaterThanOrEqual(2);
  });

  test("keeps resolver results visible on the refreshed screen", async () => {
    let index = 0;
    let screen = "";
    const result: ResolverResult = {
      ok: true,
      eventTitle: "科隆MAJOR",
      playlistPath: "out\\科隆MAJOR.dpl",
      rooms: [],
      errors: [],
    };
    const io = {
      write(chunk: string) {
        screen += chunk;
      },
      async question(prompt: string) {
        screen += prompt;
        return ["2", "0"][index++] ?? "0";
      },
      clear() {
        screen = "";
      },
      close() {},
    };

    await runTui({ io, resolve: vi.fn().mockResolvedValue(result), openPlaylist: vi.fn() });

    expect(screen).toContain("Resolve complete");
    expect(screen).toContain("Event: 科隆MAJOR");
    expect(screen).toContain("1. Resolve CS2 streams and open in PotPlayer");
  });

  test("resolves and opens playlist from menu option 1", async () => {
    const result: ResolverResult = {
      ok: true,
      eventTitle: "科隆MAJOR",
      playlistPath: "out\\科隆MAJOR.dpl",
      rooms: [
        {
          platform: "douyu",
          roomId: "1",
          roomUrl: "https://www.douyu.com/1",
          label: "主舞台",
          ok: true,
          stream: { url: "https://example.test/live.flv", format: "flv" },
        },
      ],
      errors: [],
    };
    const { io, getOutput } = createIo(["1", "0"]);
    const resolve = vi.fn().mockResolvedValue(result);
    const openPlaylist = vi.fn().mockReturnValue({ ok: true, mode: "potplayer", executablePath: "C:\\PotPlayer\\PotPlayerMini64.exe" });

    const exitCode = await runTui({ io, resolve, openPlaylist });

    expect(exitCode).toBe(0);
    expect(resolve).toHaveBeenCalledWith({
      anchors: defaultAnchors,
      outputDir: "out",
      cleanStreamFilter: "clean-only",
    });
    expect(openPlaylist).toHaveBeenCalledWith("out\\科隆MAJOR.dpl", { explicitPath: undefined });
    expect(getOutput()).toContain("Opened in PotPlayer");
    expect(getOutput()).toContain("科隆MAJOR");
  });

  test("does not open playlist from menu option 2", async () => {
    const result: ResolverResult = {
      ok: true,
      eventTitle: "科隆MAJOR",
      playlistPath: "out\\科隆MAJOR.dpl",
      rooms: [],
      errors: [],
    };
    const { io } = createIo(["2", "0"]);
    const resolve = vi.fn().mockResolvedValue(result);
    const openPlaylist = vi.fn();

    await runTui({ io, resolve, openPlaylist });

    expect(resolve).toHaveBeenCalledOnce();
    expect(openPlaylist).not.toHaveBeenCalled();
  });

  test("updates output directory before resolving", async () => {
    const result: ResolverResult = { ok: false, rooms: [], errors: [] };
    const { io } = createIo(["4", "1", "D:\\Streams", "0", "2", "0"]);
    const resolve = vi.fn().mockResolvedValue(result);

    await runTui({ io, resolve, openPlaylist: vi.fn() });

    expect(resolve).toHaveBeenCalledWith({
      anchors: defaultAnchors,
      outputDir: "D:\\Streams",
      cleanStreamFilter: "clean-only",
    });
  });

  test("can disable a platform before resolving", async () => {
    const result: ResolverResult = { ok: false, rooms: [], errors: [] };
    const { io, getOutput } = createIo(["5", "3", "0", "2", "0"]);
    const resolve = vi.fn().mockResolvedValue(result);

    await runTui({ io, resolve, openPlaylist: vi.fn() });

    expect(getOutput()).toContain("Bilibili disabled.");
    expect(resolve).toHaveBeenCalledWith({
      anchors: defaultAnchors.filter((anchor) => !anchor.includes("bilibili")),
      outputDir: "out",
      cleanStreamFilter: "clean-only",
    });
  });

  test("captures browser cookies from account authentication settings", async () => {
    const result: ResolverResult = { ok: false, rooms: [], errors: [] };
    const { io, getOutput } = createIo(["4", "4", "1", "0", "2", "0"]);
    const resolve = vi.fn().mockResolvedValue(result);
    const captureBrowserCookies = vi.fn().mockResolvedValue("SESSDATA=abc; bili_jct=def");

    await runTui({ io, resolve, openPlaylist: vi.fn(), captureBrowserCookies });

    expect(captureBrowserCookies).toHaveBeenCalledWith("bilibili");
    expect(getOutput()).toContain("Bilibili browser cookies captured.");
    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({
      platformCookieHeaders: { bilibili: "SESSDATA=abc; bili_jct=def" },
    }));
  });

  test("keeps the TUI open when browser cookie capture fails", async () => {
    const { io, getOutput } = createIo(["4", "4", "1", "0", "0"]);
    const captureBrowserCookies = vi.fn().mockRejectedValue(new Error("browser executable is missing"));

    const exitCode = await runTui({
      io,
      resolve: vi.fn(),
      openPlaylist: vi.fn(),
      captureBrowserCookies,
    });

    expect(exitCode).toBe(0);
    expect(getOutput()).toContain("Browser login failed: browser executable is missing");
    expect(getOutput()).toContain("set CS2STREAM_BROWSER_PATH");
  });

  test("shows platform settings instead of placeholder messages", async () => {
    const { io, getOutput } = createIo(["5", "0", "0"]);

    await runTui({ io, resolve: vi.fn(), openPlaylist: vi.fn() });

    expect(getOutput()).toContain("Platform settings");
    expect(getOutput()).toContain("[x] Douyu");
  });

  test("can switch clean stream filter from settings", async () => {
    const result: ResolverResult = { ok: false, rooms: [], errors: [] };
    const { io, getOutput } = createIo(["4", "2", "0", "2", "0"]);
    const resolve = vi.fn().mockResolvedValue(result);

    await runTui({ io, resolve, openPlaylist: vi.fn() });

    expect(getOutput()).toContain("Clean stream filter switched to: all rooms.");
    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({ outputDir: "out", cleanStreamFilter: "all" }));
  });

  test("switches language between Chinese and English", async () => {
    const { io, getOutput } = createIo(["9", "1", "9", "2", "0"]);

    await runTui({ io, resolve: vi.fn(), openPlaylist: vi.fn() });

    expect(getOutput()).toContain("语言已切换为中文。");
    expect(getOutput()).toContain("CS2 直播助手");
    expect(getOutput()).toContain("Language switched to English.");
    expect(getOutput()).toContain("CS2 Stream Assistant");
  });

  test("exits cleanly when input closes during language prompt", async () => {
    let questionCount = 0;
    const io = {
      write() {},
      async question() {
        questionCount += 1;
        if (questionCount === 1) {
          return "9";
        }

        const error = new Error("readline was closed");
        Object.assign(error, { code: "ERR_USE_AFTER_CLOSE" });
        throw error;
      },
      close() {},
    };

    await expect(runTui({ io, resolve: vi.fn(), openPlaylist: vi.fn() })).resolves.toBe(0);
  });

  test("exits cleanly when piped input ends after a command", async () => {
    let output = "";
    const result: ResolverResult = {
      ok: true,
      eventTitle: "科隆MAJOR",
      playlistPath: "out\\科隆MAJOR.dpl",
      rooms: [],
      errors: [],
    };
    const io = {
      write(chunk: string) {
        output += chunk;
      },
      async question(prompt: string) {
        output += prompt;
        if (output.includes("Resolve complete")) {
          const error = new Error("readline was closed");
          Object.assign(error, { code: "ERR_USE_AFTER_CLOSE" });
          throw error;
        }

        return "2";
      },
      close() {},
    };

    const exitCode = await runTui({ io, resolve: vi.fn().mockResolvedValue(result), openPlaylist: vi.fn() });

    expect(exitCode).toBe(0);
    expect(output).toContain("Resolve complete");
  });
});
