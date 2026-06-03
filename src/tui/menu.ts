import type { ResolverResult } from "../types.js";

export type MenuAction =
  | "resolve-and-open"
  | "resolve-only"
  | "show-last-result"
  | "set-potplayer-path"
  | "set-anchor"
  | "set-output-dir"
  | "auth-settings"
  | "platform-settings"
  | "set-language"
  | "exit"
  | "invalid";

export type TuiLanguage = "en" | "zh";
export type CleanStreamFilter = "clean-only" | "all";

export interface TuiState {
  anchor: string;
  outputDir: string;
  language: TuiLanguage;
  cleanStreamFilter: CleanStreamFilter;
  potPlayerPath?: string;
  lastResult?: ResolverResult;
}

export function createInitialTuiState(): TuiState {
  return {
    anchor: "https://www.douyu.com/601514",
    outputDir: "out",
    language: "en",
    cleanStreamFilter: "clean-only",
  };
}

export function renderMainMenu(state: TuiState): string {
  if (state.language === "zh") {
    return [
      "",
      "CS2 直播助手",
      "",
      `入口: ${state.anchor}`,
      `输出目录: ${state.outputDir}`,
      `PotPlayer: ${state.potPlayerPath || "自动"}`,
      "",
      "1. 获取斗鱼 CS2 赛事并打开 PotPlayer",
      "2. 只生成 PotPlayer 播放列表",
      "3. 查看上一次结果",
      "4. 设置 PotPlayer 路径",
      "5. 设置斗鱼入口",
      "6. 设置输出目录",
      "7. 账号验证设置",
      "8. 其他平台设置",
      "9. 语言",
      "0. 退出",
      "",
    ].join("\n");
  }

  return [
    "",
    "CS2 Stream Assistant",
    "",
    `Anchor: ${state.anchor}`,
    `Output: ${state.outputDir}`,
    `PotPlayer: ${state.potPlayerPath || "auto"}`,
    "",
    "1. Resolve Douyu CS2 and open in PotPlayer",
    "2. Resolve Douyu CS2 and only generate playlist",
    "3. Show last result",
    "4. Set PotPlayer path",
    "5. Set Douyu anchor",
    "6. Set output directory",
    "7. Account authentication settings",
    "8. Other platform settings",
    "9. Language",
    "0. Exit",
    "",
  ].join("\n");
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
      return "set-potplayer-path";
    case "5":
      return "set-anchor";
    case "6":
      return "set-output-dir";
    case "7":
      return "auth-settings";
    case "8":
      return "platform-settings";
    case "9":
      return "set-language";
    case "0":
      return "exit";
    default:
      return "invalid";
  }
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
  return language === "zh" ? "正在解析斗鱼 CS2 房间...\n" : "Resolving Douyu CS2 rooms...\n";
}

export function renderSelectOptionPrompt(language: TuiLanguage): string {
  return language === "zh" ? "请选择: " : "Select option: ";
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
        lines.push(`- ${room.label}: ${room.error?.message ?? "未知错误"}`);
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
      lines.push(`- ${room.label}: ${room.error?.message ?? "unknown error"}`);
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
      return "账号验证设置将在后续版本开放。";
    }

    return "虎牙和 Bilibili 支持将在后续版本开放。";
  }

  if (action === "auth-settings") {
    return "Account authentication settings are reserved for a later version.";
  }

  return "Huya and Bilibili support is reserved for a later version.";
}
