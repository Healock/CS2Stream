import { visibleWidth } from "@earendil-works/pi-tui";
import { DEFAULT_BILIBILI_ANCHOR } from "../config.js";
import { formatPlatformRoomLabel } from "../platform-labels.js";
import {
  PLATFORM_NAMES,
  PLATFORM_ORDER,
  createDefaultPlatformAnchors,
  createDefaultPlatformSelection,
  getSelectedPlatformNames,
  type PlatformAnchors,
  type PlatformCookieHeaders,
  type PlatformSelection,
} from "../platform-config.js";
import type { PlatformId, ResolverResult } from "../types.js";

export type MenuAction =
  | "resolve-and-open"
  | "resolve-only"
  | "show-last-result"
  | "settings"
  | "platform-settings"
  | "set-language"
  | "exit"
  | "invalid";

export type TuiLanguage = "en" | "zh";
export type CleanStreamFilter = "clean-only" | "all";
export type SettingsAction =
  | "set-output-dir"
  | "toggle-clean-stream-filter"
  | "set-potplayer-path"
  | "auth-settings"
  | "back"
  | "invalid";
export type PlatformSettingsAction =
  | "toggle-douyu"
  | "toggle-huya"
  | "toggle-bilibili"
  | "edit-douyu"
  | "edit-huya"
  | "edit-bilibili"
  | "back"
  | "invalid";

export interface TuiState {
  outputDir: string;
  language: TuiLanguage;
  cleanStreamFilter: CleanStreamFilter;
  platformSelection: PlatformSelection;
  platformAnchors: PlatformAnchors;
  platformCookieHeaders: PlatformCookieHeaders;
  potPlayerPath?: string;
  lastResult?: ResolverResult;
  statusMessage?: string;
}

export function createInitialTuiState(): TuiState {
  return {
    outputDir: "out",
    language: "en",
    cleanStreamFilter: "clean-only",
    platformSelection: createDefaultPlatformSelection(),
    platformAnchors: createDefaultPlatformAnchors(),
    platformCookieHeaders: {},
  };
}

export function renderMainMenu(state: TuiState): string {
  const lines = state.language === "zh"
    ? [
        "",
        "CS2 直播助手",
        "",
        ...renderStatusBox(state),
        "",
        "1. 获取 CS2 赛事流并打开 PotPlayer",
        "2. 只生成 PotPlayer 播放列表",
        "3. 查看上一次结果",
        "4. 设置",
        "5. 平台设置",
        "9. 语言",
        "0. 退出",
        "",
      ]
    : [
        "",
        "CS2 Stream Assistant",
        "",
        ...renderStatusBox(state),
        "",
        "1. Resolve CS2 streams and open in PotPlayer",
        "2. Resolve CS2 streams and only generate playlist",
        "3. Show last result",
        "4. Settings",
        "5. Platform settings",
        "9. Language",
        "0. Exit",
        "",
      ];

  return lines.join("\n");
}

export function renderStatusBox(state: TuiState): string[] {
  const language = state.language;
  const rows = language === "zh"
    ? [
        `平台: ${getSelectedPlatformNames(state.platformSelection, language)}`,
        `输出目录: ${state.outputDir}`,
        `PotPlayer: ${state.potPlayerPath || "自动"}`,
        `纯净流策略: ${renderCleanStreamFilterLabel(state.cleanStreamFilter, language)}`,
      ]
    : [
        `Platforms: ${getSelectedPlatformNames(state.platformSelection, language)}`,
        `Output: ${state.outputDir}`,
        `PotPlayer: ${state.potPlayerPath || "auto"}`,
        `Clean stream filter: ${renderCleanStreamFilterLabel(state.cleanStreamFilter, language)}`,
  ];
  const title = "CS2Stream";
  const titleContent = ` ${title} `;
  const innerWidth = Math.max(visibleWidth(titleContent), ...rows.map((row) => visibleWidth(` ${row} `)));
  const top = `┌${titleContent}${"─".repeat(Math.max(0, innerWidth - visibleWidth(titleContent)))}┐`;
  const body = rows.map((row) => {
    const content = ` ${row} `;
    return `│${content}${" ".repeat(Math.max(0, innerWidth - visibleWidth(content)))}│`;
  });
  const bottom = `└${"─".repeat(innerWidth)}┘`;
  return [top, ...body, bottom];
}

export function parseMenuAction(input: string): MenuAction {
  switch (input.trim()) {
    case "1":
      return "resolve-and-open";
    case "2":
      return "resolve-only";
    case "3":
      return "show-last-result";
    case "4":
      return "settings";
    case "5":
      return "platform-settings";
    case "9":
      return "set-language";
    case "0":
      return "exit";
    default:
      return "invalid";
  }
}

export function renderSettingsMenu(state: TuiState): string {
  if (state.language === "zh") {
    return [
      "",
      "设置",
      "",
      "1. 设置输出目录",
      `2. 纯净流策略: ${renderCleanStreamFilterLabel(state.cleanStreamFilter, state.language)}`,
      "3. 设置 PotPlayer 路径",
      "4. 账号验证设置",
      "0. 返回",
      "",
    ].join("\n");
  }

  return [
    "",
    "Settings",
    "",
    "1. Set output directory",
    `2. Clean stream filter: ${renderCleanStreamFilterLabel(state.cleanStreamFilter, state.language)}`,
    "3. Set PotPlayer path",
    "4. Account authentication settings",
    "0. Back",
    "",
  ].join("\n");
}

export function parseSettingsAction(input: string): SettingsAction {
  switch (input.trim()) {
    case "1":
      return "set-output-dir";
    case "2":
      return "toggle-clean-stream-filter";
    case "3":
      return "set-potplayer-path";
    case "4":
      return "auth-settings";
    case "0":
      return "back";
    default:
      return "invalid";
  }
}

export function renderPlatformSettingsMenu(state: TuiState): string {
  const language = state.language;
  if (language === "zh") {
    return [
      "",
      "平台设置",
      "",
      ...PLATFORM_ORDER.map((platform, index) => `${index + 1}. [${state.platformSelection[platform] ? "x" : " "}] ${PLATFORM_NAMES[platform].zh}`),
      `4. 编辑斗鱼入口: ${state.platformAnchors.douyu.join(", ")}`,
      `5. 编辑虎牙入口: ${state.platformAnchors.huya.join(", ")}`,
      `6. 编辑 Bilibili 入口: ${state.platformAnchors.bilibili.join(", ")}`,
      "0. 返回",
      "",
    ].join("\n");
  }

  return [
    "",
    "Platform settings",
    "",
    ...PLATFORM_ORDER.map((platform, index) => `${index + 1}. [${state.platformSelection[platform] ? "x" : " "}] ${PLATFORM_NAMES[platform].en}`),
    `4. Edit Douyu entries: ${state.platformAnchors.douyu.join(", ")}`,
    `5. Edit Huya entries: ${state.platformAnchors.huya.join(", ")}`,
    `6. Edit Bilibili entries: ${state.platformAnchors.bilibili.join(", ")}`,
    "0. Back",
    "",
  ].join("\n");
}

export function parsePlatformSettingsAction(input: string): PlatformSettingsAction {
  switch (input.trim()) {
    case "1":
      return "toggle-douyu";
    case "2":
      return "toggle-huya";
    case "3":
      return "toggle-bilibili";
    case "4":
      return "edit-douyu";
    case "5":
      return "edit-huya";
    case "6":
      return "edit-bilibili";
    case "0":
      return "back";
    default:
      return "invalid";
  }
}

export function platformFromToggleAction(action: PlatformSettingsAction): PlatformId | undefined {
  if (action === "toggle-douyu") return "douyu";
  if (action === "toggle-huya") return "huya";
  if (action === "toggle-bilibili") return "bilibili";
  return undefined;
}

export function platformFromEditAction(action: PlatformSettingsAction): PlatformId | undefined {
  if (action === "edit-douyu") return "douyu";
  if (action === "edit-huya") return "huya";
  if (action === "edit-bilibili") return "bilibili";
  return undefined;
}

export function renderCleanStreamFilterLabel(filter: CleanStreamFilter, language: TuiLanguage): string {
  if (language === "zh") {
    return filter === "clean-only" ? "仅纯净流" : "全部房间";
  }

  return filter === "clean-only" ? "clean-only" : "all rooms";
}

export function renderCleanStreamFilterChangedMessage(filter: CleanStreamFilter, language: TuiLanguage): string {
  if (language === "zh") {
    return `纯净流策略已切换为: ${renderCleanStreamFilterLabel(filter, language)}。`;
  }

  return `Clean stream filter switched to: ${renderCleanStreamFilterLabel(filter, language)}.`;
}

export function renderPlatformToggleMessage(platform: PlatformId, enabled: boolean, language: TuiLanguage): string {
  const name = PLATFORM_NAMES[platform][language];
  if (language === "zh") {
    return `${name} 已${enabled ? "启用" : "禁用"}。`;
  }

  return `${name} ${enabled ? "enabled" : "disabled"}.`;
}

export function renderPlatformCookieCapturedMessage(platform: PlatformId, language: TuiLanguage): string {
  const name = PLATFORM_NAMES[platform][language];
  return language === "zh" ? `${name} 浏览器 Cookie 已获取。` : `${name} browser cookies captured.`;
}

export function renderBrowserAuthFailedMessage(error: unknown, language: TuiLanguage): string {
  const message = error instanceof Error ? error.message : String(error);
  if (language === "zh") {
    return `浏览器登录失败: ${message}\n请安装 Playwright 浏览器: npx playwright install，或设置 CS2STREAM_BROWSER_PATH 指向 Chrome/Edge。`;
  }

  return `Browser login failed: ${message}\nInstall Playwright browsers with npx playwright install, or set CS2STREAM_BROWSER_PATH to Chrome/Edge.`;
}

export function parseLanguageSelection(input: string): TuiLanguage | undefined {
  switch (input.trim().toLowerCase()) {
    case "1":
    case "zh":
    case "中文":
      return "zh";
    case "2":
    case "en":
    case "english":
      return "en";
    default:
      return undefined;
  }
}

export function renderLanguagePrompt(language: TuiLanguage): string {
  if (language === "zh") {
    return "请选择语言: 1. 中文  2. English\nLanguage: ";
  }

  return "Select language: 1. 中文  2. English\nLanguage: ";
}

export function renderLanguageChangedMessage(language: TuiLanguage): string {
  return language === "zh" ? "语言已切换为中文。" : "Language switched to English.";
}

export function renderInvalidLanguageMessage(language: TuiLanguage): string {
  return language === "zh" ? "无效的语言选项。" : "Invalid language option.";
}

export function renderInvalidOptionMessage(language: TuiLanguage): string {
  return language === "zh" ? "无效选项。" : "Invalid option.";
}

export function renderNoPreviousResultMessage(language: TuiLanguage): string {
  return language === "zh" ? "没有上一次结果。" : "No previous result.";
}

export function renderResolvingMessage(language: TuiLanguage): string {
  return language === "zh" ? "正在解析 CS2 赛事流...\n" : "Resolving CS2 streams...\n";
}

export function renderSelectOptionPrompt(language: TuiLanguage): string {
  return language === "zh" ? "请选择: " : "Select option: ";
}

export function renderAuthPlatformPrompt(language: TuiLanguage): string {
  if (language === "zh") {
    return `选择要登录的平台: 1. Bilibili  2. 斗鱼  3. 虎牙  0. 返回\n平台: `;
  }

  return `Select platform login: 1. Bilibili  2. Douyu  3. Huya  0. Back\nPlatform: `;
}

export function parseAuthPlatformSelection(input: string): PlatformId | "back" | undefined {
  switch (input.trim().toLowerCase()) {
    case "1":
    case "bilibili":
    case "bili":
      return "bilibili";
    case "2":
    case "douyu":
      return "douyu";
    case "3":
    case "huya":
      return "huya";
    case "0":
      return "back";
    default:
      return undefined;
  }
}

export function renderResultSummary(result: ResolverResult, language: TuiLanguage = "en"): string {
  const lines: string[] = [];

  if (language === "zh") {
    if (result.ok) {
      lines.push("解析完成");
      lines.push(`赛事: ${result.eventTitle ?? "(未知)"}`);
      lines.push(`播放列表: ${result.playlistPath ?? "(未写入)"}`);
    } else {
      lines.push("解析失败");
      if (result.eventTitle) {
        lines.push(`赛事: ${result.eventTitle}`);
      }
      if (result.playlistPath) {
        lines.push(`播放列表: ${result.playlistPath}`);
      }
    }

    const total = result.rooms.length;
    const playable = result.rooms.filter((room) => room.ok).length;
    const failed = total - playable;
    lines.push(`房间: ${total} 个，总可播放 ${playable} 个，失败 ${failed} 个`);

    const failedRooms = result.rooms.filter((room) => !room.ok);
    if (failedRooms.length > 0) {
      lines.push("失败房间:");
      for (const room of failedRooms) {
        lines.push(`- ${formatPlatformRoomLabel(room.platform, room.label)}: ${room.error?.message ?? "未知错误"}`);
      }
    }

    if (!result.ok && result.errors.length > 0) {
      lines.push("错误:");
      for (const error of result.errors) {
        lines.push(`- ${error.code}: ${error.message}`);
      }
    }

    return lines.join("\n");
  }

  if (result.ok) {
    lines.push("Resolve complete");
    lines.push(`Event: ${result.eventTitle ?? "(unknown)"}`);
    lines.push(`Playlist: ${result.playlistPath ?? "(not written)"}`);
  } else {
    lines.push("Resolve failed");
    if (result.eventTitle) {
      lines.push(`Event: ${result.eventTitle}`);
    }
    if (result.playlistPath) {
      lines.push(`Playlist: ${result.playlistPath}`);
    }
  }

  const total = result.rooms.length;
  const playable = result.rooms.filter((room) => room.ok).length;
  const failed = total - playable;
  lines.push(`Rooms: ${total} total, ${playable} playable, ${failed} failed`);

  const failedRooms = result.rooms.filter((room) => !room.ok);
  if (failedRooms.length > 0) {
    lines.push("Failed rooms:");
    for (const room of failedRooms) {
      lines.push(`- ${formatPlatformRoomLabel(room.platform, room.label)}: ${room.error?.message ?? "unknown error"}`);
    }
  }

  if (!result.ok && result.errors.length > 0) {
    lines.push("Errors:");
    for (const error of result.errors) {
      lines.push(`- ${error.code}: ${error.message}`);
    }
  }

  return lines.join("\n");
}

export function renderPlaceholderMessage(action: "auth-settings" | "platform-settings", language: TuiLanguage = "en"): string {
  if (language === "zh") {
    if (action === "auth-settings") {
      return `账号验证会打开浏览器登录页。Bilibili 默认入口: ${DEFAULT_BILIBILI_ANCHOR}`;
    }

    return "平台设置可选择启用的平台，并配置各平台入口。";
  }

  if (action === "auth-settings") {
    return `Account authentication opens a browser login page. Bilibili default entry: ${DEFAULT_BILIBILI_ANCHOR}`;
  }

  return "Platform settings let you choose enabled platforms and configure platform entries.";
}
