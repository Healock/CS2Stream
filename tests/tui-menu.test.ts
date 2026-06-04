import { describe, expect, test } from "vitest";
import { visibleWidth } from "@earendil-works/pi-tui";
import type { ResolverResult } from "../src/types.js";
import {
  createInitialTuiState,
  parseLanguageSelection,
  parseMenuAction,
  parsePlatformSettingsAction,
  parseSettingsAction,
  renderCleanStreamFilterLabel,
  renderPlaceholderMessage,
  renderMainMenu,
  renderPlatformSettingsMenu,
  renderResolvingMessage,
  renderResultSummary,
  renderSettingsMenu,
  renderStatusBox,
} from "../src/tui/menu.js";

describe("TUI menu", () => {
  test("renders default CS2 state", () => {
    const menu = renderMainMenu(createInitialTuiState());

    expect(menu).toContain("CS2 Stream Assistant");
    expect(menu).not.toContain("Entry: https://www.douyu.com/601514");
    expect(menu).toContain("┌");
    expect(menu).toContain("Platforms: Douyu, Huya, Bilibili");
    expect(menu).toContain("Output: out");
    expect(menu).toContain("PotPlayer: auto");
    expect(menu).toContain("1. Resolve CS2 streams and open in PotPlayer");
    expect(menu).toContain("2. Resolve CS2 streams and only generate playlist");
    expect(menu).toContain("4. Settings");
    expect(menu).toContain("5. Platform settings");
    expect(menu).toContain("9. Language");
    expect(menu).toContain("0. Exit");
    expect(menu).not.toContain("Resolve Douyu");
    expect(menu).not.toContain("Set PotPlayer path");
    expect(menu).not.toContain("5. Set Douyu anchor");
    expect(menu).not.toContain("6. Set output directory");
    expect(menu).not.toContain("7. Account authentication settings");
  });

  test("renders Chinese menu state", () => {
    const menu = renderMainMenu({ ...createInitialTuiState(), language: "zh" });

    expect(menu).toContain("CS2 直播助手");
    expect(menu).not.toContain("入口: https://www.douyu.com/601514");
    expect(menu).toContain("平台: 斗鱼、虎牙、Bilibili");
    expect(menu).toContain("输出目录: out");
    expect(menu).toContain("PotPlayer: 自动");
    expect(menu).toContain("1. 获取 CS2 赛事流并打开 PotPlayer");
    expect(menu).toContain("4. 设置");
    expect(menu).toContain("5. 平台设置");
    expect(menu).toContain("9. 语言");
    expect(menu).toContain("0. 退出");
  });

  test("renders Chinese status box with aligned terminal display widths", () => {
    const lines = renderStatusBox({ ...createInitialTuiState(), language: "zh" });
    const widths = lines.map((line) => visibleWidth(line));

    expect(new Set(widths).size).toBe(1);
  });

  test.each([
    ["1", "resolve-and-open"],
    ["2", "resolve-only"],
    ["3", "show-last-result"],
    ["4", "settings"],
    ["5", "platform-settings"],
    ["9", "set-language"],
    ["0", "exit"],
  ] as const)("maps input %s to %s", (input, action) => {
    expect(parseMenuAction(input)).toBe(action);
  });

  test("trims input before parsing", () => {
    expect(parseMenuAction(" 1 ")).toBe("resolve-and-open");
  });

  test("returns invalid for unknown menu choices", () => {
    expect(parseMenuAction("6")).toBe("invalid");
    expect(parseMenuAction("7")).toBe("invalid");
    expect(parseMenuAction("8")).toBe("invalid");
    expect(parseMenuAction("10")).toBe("invalid");
    expect(parseMenuAction("abc")).toBe("invalid");
  });

  test("renders settings menu", () => {
    const menu = renderSettingsMenu(createInitialTuiState());

    expect(menu).toContain("Settings");
    expect(menu).toContain("1. Set output directory");
    expect(menu).toContain("2. Clean stream filter: clean-only");
    expect(menu).toContain("3. Set PotPlayer path");
    expect(menu).toContain("4. Account authentication settings");
    expect(menu).toContain("0. Back");
  });

  test("renders Chinese settings menu", () => {
    const menu = renderSettingsMenu({ ...createInitialTuiState(), language: "zh" });

    expect(menu).toContain("设置");
    expect(menu).toContain("1. 设置输出目录");
    expect(menu).toContain("2. 纯净流策略: 仅纯净流");
    expect(menu).toContain("3. 设置 PotPlayer 路径");
    expect(menu).toContain("4. 账号验证设置");
    expect(menu).toContain("0. 返回");
  });

  test.each([
    ["1", "set-output-dir"],
    ["2", "toggle-clean-stream-filter"],
    ["3", "set-potplayer-path"],
    ["4", "auth-settings"],
    ["0", "back"],
  ] as const)("maps settings input %s to %s", (input, action) => {
    expect(parseSettingsAction(input)).toBe(action);
  });

  test("returns invalid for unknown settings choices", () => {
    expect(parseSettingsAction("9")).toBe("invalid");
  });

  test("renders platform settings as a multi-select page with platform entries", () => {
    const menu = renderPlatformSettingsMenu(createInitialTuiState());

    expect(menu).toContain("Platform settings");
    expect(menu).toContain("1. [x] Douyu");
    expect(menu).toContain("2. [x] Huya");
    expect(menu).toContain("3. [x] Bilibili");
    expect(menu).toContain("4. Edit Douyu entries");
    expect(menu).toContain("https://www.huya.com/eslcsgo2");
  });

  test.each([
    ["1", "toggle-douyu"],
    ["2", "toggle-huya"],
    ["3", "toggle-bilibili"],
    ["4", "edit-douyu"],
    ["5", "edit-huya"],
    ["6", "edit-bilibili"],
    ["0", "back"],
  ] as const)("maps platform settings input %s to %s", (input, action) => {
    expect(parsePlatformSettingsAction(input)).toBe(action);
  });

  test("renders clean stream filter labels", () => {
    expect(renderCleanStreamFilterLabel("clean-only", "en")).toBe("clean-only");
    expect(renderCleanStreamFilterLabel("all", "en")).toBe("all rooms");
    expect(renderCleanStreamFilterLabel("clean-only", "zh")).toBe("仅纯净流");
    expect(renderCleanStreamFilterLabel("all", "zh")).toBe("全部房间");
  });

  test("renders generic resolving messages", () => {
    expect(renderResolvingMessage("en")).toBe("Resolving CS2 streams...\n");
    expect(renderResolvingMessage("zh")).toBe("正在解析 CS2 赛事流...\n");
  });

  test.each([
    ["1", "zh"],
    ["zh", "zh"],
    ["中文", "zh"],
    ["2", "en"],
    ["en", "en"],
    ["english", "en"],
  ] as const)("maps language input %s to %s", (input, language) => {
    expect(parseLanguageSelection(input)).toBe(language);
  });

  test("returns undefined for invalid language choices", () => {
    expect(parseLanguageSelection("3")).toBeUndefined();
  });
});

describe("TUI result summaries", () => {
  test("summarizes successful resolver result", () => {
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
        {
          platform: "douyu",
          roomId: "2",
          roomUrl: "https://www.douyu.com/2",
          label: "副舞台",
          ok: false,
          error: { code: "stream_resolution_failed", message: "offline" },
        },
      ],
      errors: [{ code: "stream_resolution_failed", message: "offline" }],
    };

    const summary = renderResultSummary(result);

    expect(summary).toContain("Event: 科隆MAJOR");
    expect(summary).toContain("Playlist: out\\科隆MAJOR.dpl");
    expect(summary).toContain("Rooms: 2 total, 1 playable, 1 failed");
    expect(summary).toContain("- 1-副舞台: offline");
  });

  test("summarizes failed resolver result without rooms", () => {
    const result: ResolverResult = {
      ok: false,
      rooms: [],
      errors: [{ code: "anchor_unreachable", message: "network failed" }],
    };

    const summary = renderResultSummary(result);

    expect(summary).toContain("Resolve failed");
    expect(summary).toContain("- anchor_unreachable: network failed");
  });

  test("renders explicit placeholder messages", () => {
    expect(renderPlaceholderMessage("auth-settings")).toContain("opens a browser login page");
    expect(renderPlaceholderMessage("platform-settings")).toContain("choose enabled platforms");
    expect(renderPlaceholderMessage("auth-settings", "zh")).toContain("浏览器登录页");
    expect(renderPlaceholderMessage("platform-settings", "zh")).toContain("平台设置可选择启用的平台");
  });
});
