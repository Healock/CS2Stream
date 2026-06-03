import { describe, expect, test, vi } from "vitest";
import { runTui } from "../src/tui.js";
import type { ResolverResult } from "../src/types.js";

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
    expect(resolve).toHaveBeenCalledWith({ anchor: "https://www.douyu.com/601514", outputDir: "out" });
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

  test("updates anchor and output directory before resolving", async () => {
    const result: ResolverResult = { ok: false, rooms: [], errors: [] };
    const { io } = createIo(["5", "123456", "6", "D:\\Streams", "2", "0"]);
    const resolve = vi.fn().mockResolvedValue(result);

    await runTui({ io, resolve, openPlaylist: vi.fn() });

    expect(resolve).toHaveBeenCalledWith({ anchor: "123456", outputDir: "D:\\Streams" });
  });

  test("shows placeholder messages", async () => {
    const { io, getOutput } = createIo(["7", "8", "0"]);

    await runTui({ io, resolve: vi.fn(), openPlaylist: vi.fn() });

    expect(getOutput()).toContain("Account authentication settings are reserved");
    expect(getOutput()).toContain("Huya and Bilibili support is reserved");
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
