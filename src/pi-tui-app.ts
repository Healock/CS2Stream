import { Key, matchesKey, truncateToWidth, type Component } from "@earendil-works/pi-tui";
import { capturePlatformBrowserCookies } from "./browser-auth.js";
import { openPlaylistInPotPlayer, type OpenPlaylistResult } from "./potplayer.js";
import { getSelectedPlatformAnchors, parseAnchorList } from "./platform-config.js";
import { runResolver, type RunResolverOptions } from "./resolver.js";
import {
  createInitialTuiState,
  renderBrowserAuthFailedMessage,
  renderCleanStreamFilterChangedMessage,
  renderCleanStreamFilterLabel,
  renderLanguageChangedMessage,
  renderPlatformCookieCapturedMessage,
  renderPlatformToggleMessage,
  renderResultSummary,
  renderStatusBox,
  type TuiState,
} from "./tui/menu.js";
import type { PlatformId, ResolverResult } from "./types.js";

export type PiTuiResolveFn = (options: RunResolverOptions) => Promise<ResolverResult>;
export type PiTuiOpenPlaylistFn = (playlistPath: string, options: { explicitPath?: string }) => OpenPlaylistResult;
export type PiTuiCaptureBrowserCookiesFn = (platform: PlatformId) => Promise<string>;

export interface PiTuiAppOptions {
  resolve?: PiTuiResolveFn;
  openPlaylist?: PiTuiOpenPlaylistFn;
  captureBrowserCookies?: PiTuiCaptureBrowserCookiesFn;
  requestRender?: () => void;
  exit: () => void;
}

type ViewMode = "main" | "settings" | "platform-settings" | "auth-settings" | "language" | "potplayer-edit" | "platform-entry-edit";
type EditorMode = "normal" | "insert" | "command";

interface MenuItem {
  label: string;
  description?: string;
  action: () => void;
}

const ASCII_ART = [
  "    ▄▄▄▄     ▄▄▄▄     ▄▄▄▄▄      ▄▄▄▄                                                     ",
  "  ██▀▀▀▀█  ▄█▀▀▀▀█   █▀▀▀▀██▄  ▄█▀▀▀▀█     ██                                             ",
  " ██▀       ██▄             ██  ██▄       ███████    ██▄████   ▄████▄    ▄█████▄  ████▄██▄ ",
  " ██         ▀████▄       ▄█▀    ▀████▄     ██       ██▀      ██▄▄▄▄██   ▀ ▄▄▄██  ██ ██ ██ ",
  " ██▄            ▀██    ▄█▀          ▀██    ██       ██       ██▀▀▀▀▀▀  ▄██▀▀▀██  ██ ██ ██ ",
  "  ██▄▄▄▄█  █▄▄▄▄▄█▀  ▄██▄▄▄▄▄  █▄▄▄▄▄█▀    ██▄▄▄    ██       ▀██▄▄▄▄█  ██▄▄▄███  ██ ██ ██ ",
  "    ▀▀▀▀    ▀▀▀▀▀    ▀▀▀▀▀▀▀▀   ▀▀▀▀▀       ▀▀▀▀    ▀▀         ▀▀▀▀▀    ▀▀▀▀ ▀▀  ▀▀ ▀▀ ▀▀ ",
];

export function createPiTuiApp(options: PiTuiAppOptions): Component & { flush(): Promise<void> } {
  return new Cs2StreamPiTuiApp(options);
}

class Cs2StreamPiTuiApp implements Component {
  private state: TuiState = createInitialTuiState();
  private viewMode: ViewMode = "main";
  private selectedIndex = 0;
  private statusMessage = "";
  private pendingTasks: Promise<void>[] = [];
  private resolve: PiTuiResolveFn;
  private openPlaylist: PiTuiOpenPlaylistFn;
  private captureBrowserCookies: PiTuiCaptureBrowserCookiesFn;
  private exit: () => void;
  private requestRender: () => void;
  private editBuffer = "";
  private editingPlatform?: PlatformId;
  private editorMode: EditorMode = "normal";
  private commandBuffer = "";

  constructor(options: PiTuiAppOptions) {
    this.resolve = options.resolve ?? runResolver;
    this.openPlaylist = options.openPlaylist ?? openPlaylistInPotPlayer;
    this.captureBrowserCookies = options.captureBrowserCookies ?? capturePlatformBrowserCookies;
    this.requestRender = options.requestRender ?? (() => {});
    this.exit = options.exit;
  }

  invalidate(): void {
  }

  async flush(): Promise<void> {
    while (this.pendingTasks.length > 0) {
      const tasks = this.pendingTasks.splice(0);
      await Promise.all(tasks);
    }
  }

  render(width: number): string[] {
    const lines = [
      ...ASCII_ART,
      "",
      ...renderStatusBox(this.state),
      "",
    ];

    if (this.viewMode === "potplayer-edit" || this.viewMode === "platform-entry-edit") {
      lines.push(...this.renderTextEditor());
    } else {
      const items = this.getCurrentMenuItems();
      lines.push(...items.map((item, index) => this.renderMenuItem(item, index)));
      lines.push("");
      lines.push(this.text("help"));
    }

    if (this.statusMessage) {
      lines.push("");
      lines.push(...this.statusMessage.split("\n"));
    }

    return lines.map((line) => truncateToWidth(line, Math.max(1, width), ""));
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.ctrl("c"))) {
      this.exit();
      return;
    }

    if (this.viewMode === "potplayer-edit" || this.viewMode === "platform-entry-edit") {
      this.handleTextEditorInput(data);
      return;
    }

    if (matchesKey(data, Key.up) || data === "k") {
      this.moveSelection(-1);
      return;
    }

    if (matchesKey(data, Key.down) || data === "j") {
      this.moveSelection(1);
      return;
    }

    if (matchesKey(data, Key.enter) || data === "\r" || data === "\n") {
      this.getCurrentMenuItems()[this.selectedIndex]?.action();
      return;
    }

    if (matchesKey(data, Key.escape)) {
      if (this.viewMode === "settings" || this.viewMode === "platform-settings" || this.viewMode === "auth-settings" || this.viewMode === "language") {
        this.openMain();
      }
      return;
    }

    const numericChoice = Number(data);
    if (Number.isInteger(numericChoice) && numericChoice >= 0) {
      this.selectByNumber(numericChoice);
    }
  }

  private renderMenuItem(item: MenuItem, index: number): string {
    const prefix = index === this.selectedIndex ? "→ " : "  ";
    const description = item.description ? `  ${item.description}` : "";
    return `${prefix}${item.label}${description}`;
  }

  private renderTextEditor(): string[] {
    const modeLabel = this.editorMode === "insert" ? "INSERT" : this.editorMode === "command" ? "COMMAND" : "NORMAL";
    const commandLine = this.editorMode === "command" ? `:${this.commandBuffer}` : "";
    const title = this.viewMode === "platform-entry-edit" ? this.text("platformEntryEditor") : this.text("potPlayerEditor");
    const valueLabel = this.viewMode === "platform-entry-edit" ? this.text("entries") : this.text("path");
    return [
      title,
      "",
      `Mode: ${modeLabel}`,
      `${valueLabel}: ${this.editBuffer}`,
      "",
      this.text("editorHelp"),
      commandLine,
    ].filter((line) => line.length > 0);
  }

  private getCurrentMenuItems(): MenuItem[] {
    if (this.viewMode === "settings") {
      return [
        { label: this.text("setOutputDirectory"), description: this.state.outputDir, action: () => this.setStatus(this.text("outputDirectoryFallback")) },
        { label: `${this.text("cleanStreamFilter")}: ${renderCleanStreamFilterLabel(this.state.cleanStreamFilter, this.state.language)}`, action: () => this.toggleCleanStreamFilter() },
        { label: this.text("setPotPlayerPath"), description: this.state.potPlayerPath || "auto", action: () => this.openPotPlayerEditor() },
        { label: this.text("authSettings"), action: () => this.openAuthSettings() },
        { label: this.text("back"), action: () => this.openMain() },
      ];
    }

    if (this.viewMode === "auth-settings") {
      return [
        { label: "Bilibili", action: () => this.captureAuthCookies("bilibili") },
        { label: this.text("douyu"), action: () => this.captureAuthCookies("douyu") },
        { label: this.text("huya"), action: () => this.captureAuthCookies("huya") },
        { label: this.text("back"), action: () => this.openSettings() },
      ];
    }

    if (this.viewMode === "platform-settings") {
      return [
        { label: this.platformToggleLabel("douyu"), action: () => this.togglePlatform("douyu") },
        { label: this.platformToggleLabel("huya"), action: () => this.togglePlatform("huya") },
        { label: this.platformToggleLabel("bilibili"), action: () => this.togglePlatform("bilibili") },
        { label: this.text("editDouyu"), description: this.state.platformAnchors.douyu.join(", "), action: () => this.openPlatformEntryEditor("douyu") },
        { label: this.text("editHuya"), description: this.state.platformAnchors.huya.join(", "), action: () => this.openPlatformEntryEditor("huya") },
        { label: this.text("editBilibili"), description: this.state.platformAnchors.bilibili.join(", "), action: () => this.openPlatformEntryEditor("bilibili") },
        { label: this.text("back"), action: () => this.openMain() },
      ];
    }

    if (this.viewMode === "language") {
      return [
        { label: "中文", description: this.state.language === "zh" ? this.text("current") : undefined, action: () => this.setLanguage("zh") },
        { label: "English", description: this.state.language === "en" ? this.text("current") : undefined, action: () => this.setLanguage("en") },
        { label: this.text("back"), action: () => this.openMain() },
      ];
    }

    return [
      { label: this.text("resolveOpen"), action: () => this.resolveAndMaybeOpen(true) },
      { label: this.text("resolveOnly"), action: () => this.resolveAndMaybeOpen(false) },
      { label: this.text("showLastResult"), action: () => this.showLastResult() },
      { label: this.text("settings"), action: () => this.openSettings() },
      { label: this.text("platformSettings"), action: () => this.openPlatformSettings() },
      { label: this.text("language"), description: `${this.text("current")}: ${this.state.language === "zh" ? "中文" : "English"}`, action: () => this.openLanguage() },
      { label: this.text("exit"), action: () => this.exit() },
    ];
  }

  private platformToggleLabel(platform: PlatformId): string {
    const checked = this.state.platformSelection[platform] ? "x" : " ";
    const name = platform === "douyu" ? this.text("douyu") : platform === "huya" ? this.text("huya") : "Bilibili";
    return `[${checked}] ${name}`;
  }

  private moveSelection(delta: number): void {
    const count = this.getCurrentMenuItems().length;
    this.selectedIndex = (this.selectedIndex + delta + count) % count;
  }

  private selectByNumber(choice: number): void {
    if (choice === 0) {
      this.exit();
      return;
    }

    const item = this.getCurrentMenuItems()[choice - 1];
    if (item) {
      this.selectedIndex = choice - 1;
      item.action();
    }
  }

  private openMain(): void {
    this.viewMode = "main";
    this.selectedIndex = 0;
  }

  private openSettings(): void {
    this.viewMode = "settings";
    this.selectedIndex = 0;
  }

  private openPlatformSettings(): void {
    this.viewMode = "platform-settings";
    this.selectedIndex = 0;
  }

  private openAuthSettings(): void {
    this.viewMode = "auth-settings";
    this.selectedIndex = 0;
    this.statusMessage = this.text("selectPlatformLogin");
  }

  private openLanguage(): void {
    this.viewMode = "language";
    this.selectedIndex = this.state.language === "zh" ? 0 : 1;
  }

  private openPotPlayerEditor(): void {
    this.viewMode = "potplayer-edit";
    this.editBuffer = this.state.potPlayerPath ?? "";
    this.editingPlatform = undefined;
    this.editorMode = "normal";
    this.commandBuffer = "";
  }

  private openPlatformEntryEditor(platform: PlatformId): void {
    this.viewMode = "platform-entry-edit";
    this.editingPlatform = platform;
    this.editBuffer = this.state.platformAnchors[platform].join(", ");
    this.editorMode = "normal";
    this.commandBuffer = "";
  }

  private handleTextEditorInput(data: string): void {
    if (this.editorMode === "insert") {
      if (matchesKey(data, Key.escape)) {
        this.editorMode = "normal";
        return;
      }
      if (matchesKey(data, Key.backspace)) {
        this.editBuffer = this.editBuffer.slice(0, -1);
        return;
      }
      if (!this.hasControlCharacters(data)) {
        this.editBuffer += data;
      }
      return;
    }

    if (this.editorMode === "command") {
      if (matchesKey(data, Key.enter) || data === "\r" || data === "\n") {
        this.runEditorCommand();
        return;
      }
      if (matchesKey(data, Key.escape)) {
        this.editorMode = "normal";
        this.commandBuffer = "";
        return;
      }
      if (matchesKey(data, Key.backspace)) {
        this.commandBuffer = this.commandBuffer.slice(0, -1);
        return;
      }
      if (!this.hasControlCharacters(data)) {
        this.commandBuffer += data;
      }
      return;
    }

    if (data === "i") {
      this.editorMode = "insert";
    } else if (data === "x") {
      this.editBuffer = this.editBuffer.slice(0, -1);
    } else if (data === ":") {
      this.editorMode = "command";
      this.commandBuffer = "";
    } else if (matchesKey(data, Key.escape)) {
      if (this.viewMode === "platform-entry-edit") {
        this.openPlatformSettings();
      } else {
        this.openMain();
      }
    }
  }

  private runEditorCommand(): void {
    const command = this.commandBuffer.trim();
    if (command === "w") {
      if (this.viewMode === "platform-entry-edit" && this.editingPlatform) {
        const anchors = parseAnchorList(this.editBuffer);
        if (anchors.length === 0) {
          this.statusMessage = this.text("platformEntryInvalid");
          this.editorMode = "normal";
          this.commandBuffer = "";
          return;
        }

        this.state.platformAnchors[this.editingPlatform] = anchors;
        this.statusMessage = this.text("platformEntrySaved");
        this.openPlatformSettings();
        return;
      }

      this.state.potPlayerPath = this.editBuffer.trim() || undefined;
      this.statusMessage = this.text("potPlayerSaved");
      this.openMain();
    } else if (command === "q") {
      this.statusMessage = this.viewMode === "platform-entry-edit" ? this.text("platformEntryCancelled") : this.text("potPlayerCancelled");
      if (this.viewMode === "platform-entry-edit") {
        this.openPlatformSettings();
      } else {
        this.openMain();
      }
    } else {
      this.statusMessage = `Unknown command: :${command}`;
      this.editorMode = "normal";
      this.commandBuffer = "";
    }
  }

  private hasControlCharacters(data: string): boolean {
    return [...data].some((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 0x7f || (code >= 0x80 && code <= 0x9f);
    });
  }

  private toggleCleanStreamFilter(): void {
    this.state.cleanStreamFilter = this.state.cleanStreamFilter === "clean-only" ? "all" : "clean-only";
    this.statusMessage = renderCleanStreamFilterChangedMessage(this.state.cleanStreamFilter, this.state.language);
  }

  private togglePlatform(platform: PlatformId): void {
    this.state.platformSelection[platform] = !this.state.platformSelection[platform];
    this.statusMessage = renderPlatformToggleMessage(platform, this.state.platformSelection[platform], this.state.language);
  }

  private captureAuthCookies(platform: PlatformId): void {
    this.statusMessage = `${this.text("openingBrowserLogin")}: ${platform === "bilibili" ? "Bilibili" : platform === "douyu" ? this.text("douyu") : this.text("huya")}`;
    const task = this.captureBrowserCookies(platform).then((cookieHeader) => {
      this.state.platformCookieHeaders[platform] = cookieHeader;
      this.statusMessage = renderPlatformCookieCapturedMessage(platform, this.state.language);
    }).catch((error: unknown) => {
      this.statusMessage = renderBrowserAuthFailedMessage(error, this.state.language);
    }).finally(() => {
      this.requestRender();
    });
    this.pendingTasks.push(task);
  }

  private showLastResult(): void {
    this.statusMessage = this.state.lastResult ? renderResultSummary(this.state.lastResult, this.state.language) : this.text("noPreviousResult");
  }

  private resolveAndMaybeOpen(shouldOpen: boolean): void {
    this.statusMessage = this.text("resolving");
    const task = this.resolve({
      anchors: getSelectedPlatformAnchors(this.state.platformSelection, this.state.platformAnchors),
      outputDir: this.state.outputDir,
      cleanStreamFilter: this.state.cleanStreamFilter,
      ...(Object.keys(this.state.platformCookieHeaders).length > 0 ? { platformCookieHeaders: this.state.platformCookieHeaders } : {}),
    }).then((result) => {
      this.state.lastResult = result;
      this.statusMessage = renderResultSummary(result, this.state.language);

      if (!shouldOpen || !result.ok || !result.playlistPath) {
        return;
      }

      const launchResult = this.openPlaylist(result.playlistPath, { explicitPath: this.state.potPlayerPath });
      if (launchResult.ok && launchResult.mode === "potplayer") {
        this.statusMessage = `${this.statusMessage}\n${this.text("openedPotPlayer")}: ${launchResult.executablePath}`;
      } else if (launchResult.ok) {
        this.statusMessage = `${this.statusMessage}\n${this.text("openedAssociation")}`;
      } else {
        this.statusMessage = `${this.statusMessage}\n${this.text("openFailed")}: ${launchResult.error}\n${this.text("playlistAvailable")}: ${result.playlistPath}`;
      }
    }).catch((error: unknown) => {
      this.statusMessage = error instanceof Error ? error.message : String(error);
    }).finally(() => {
      this.requestRender();
    });
    this.pendingTasks.push(task);
  }

  private setStatus(message: string): void {
    this.statusMessage = message;
  }

  private setLanguage(language: "en" | "zh"): void {
    this.state.language = language;
    this.statusMessage = renderLanguageChangedMessage(language);
    this.openMain();
  }

  private text(key: TextKey): string {
    return TEXT[this.state.language][key];
  }
}

type TextKey =
  | "output"
  | "cleanStreamFilter"
  | "help"
  | "potPlayerEditor"
  | "platformEntryEditor"
  | "editorHelp"
  | "path"
  | "entries"
  | "setOutputDirectory"
  | "authSettings"
  | "back"
  | "resolveOpen"
  | "resolveOnly"
  | "showLastResult"
  | "setPotPlayerPath"
  | "settings"
  | "platformSettings"
  | "language"
  | "exit"
  | "current"
  | "outputDirectoryFallback"
  | "selectPlatformLogin"
  | "openingBrowserLogin"
  | "potPlayerSaved"
  | "potPlayerCancelled"
  | "platformEntrySaved"
  | "platformEntryCancelled"
  | "platformEntryInvalid"
  | "noPreviousResult"
  | "resolving"
  | "openedPotPlayer"
  | "openedAssociation"
  | "openFailed"
  | "playlistAvailable"
  | "douyu"
  | "huya"
  | "editDouyu"
  | "editHuya"
  | "editBilibili";

const TEXT: Record<"en" | "zh", Record<TextKey, string>> = {
  en: {
    output: "Output",
    cleanStreamFilter: "Clean stream filter",
    help: "Use ↑/↓ or j/k to move, Enter to select, Esc to go back, Ctrl+C to exit.",
    potPlayerEditor: "PotPlayer Path Editor",
    platformEntryEditor: "Platform Entry Editor",
    editorHelp: "i insert   h/l move   x delete   Esc normal   :w save   :q cancel",
    path: "Path",
    entries: "Entries",
    setOutputDirectory: "Set output directory",
    authSettings: "Account authentication settings",
    back: "Back",
    resolveOpen: "Resolve CS2 streams and open in PotPlayer",
    resolveOnly: "Resolve CS2 streams and only generate playlist",
    showLastResult: "Show last result",
    setPotPlayerPath: "Set PotPlayer path",
    settings: "Settings",
    platformSettings: "Platform settings",
    language: "Language",
    exit: "Exit",
    current: "Current",
    outputDirectoryFallback: "Use the line-input fallback for output directory editing for now.",
    selectPlatformLogin: "Select platform login",
    openingBrowserLogin: "Opening browser login",
    potPlayerSaved: "PotPlayer path saved.",
    potPlayerCancelled: "PotPlayer path edit cancelled.",
    platformEntrySaved: "Platform entries saved.",
    platformEntryCancelled: "Platform entry edit cancelled.",
    platformEntryInvalid: "Enter at least one platform entry URL.",
    noPreviousResult: "No previous result.",
    resolving: "Resolving CS2 streams...",
    openedPotPlayer: "Opened in PotPlayer",
    openedAssociation: "Opened playlist using Windows file association.",
    openFailed: "Could not open playlist automatically",
    playlistAvailable: "Playlist remains available at",
    douyu: "Douyu",
    huya: "Huya",
    editDouyu: "Edit Douyu entries",
    editHuya: "Edit Huya entries",
    editBilibili: "Edit Bilibili entries",
  },
  zh: {
    output: "输出目录",
    cleanStreamFilter: "纯净流策略",
    help: "使用 ↑/↓ 或 j/k 移动，Enter 确认，Esc 返回，Ctrl+C 退出。",
    potPlayerEditor: "PotPlayer 路径编辑器",
    platformEntryEditor: "平台入口编辑器",
    editorHelp: "i 插入   h/l 移动   x 删除   Esc 普通模式   :w 保存   :q 取消",
    path: "路径",
    entries: "入口",
    setOutputDirectory: "设置输出目录",
    authSettings: "账号验证设置",
    back: "返回",
    resolveOpen: "获取 CS2 赛事流并打开 PotPlayer",
    resolveOnly: "只生成 PotPlayer 播放列表",
    showLastResult: "查看上一次结果",
    setPotPlayerPath: "设置 PotPlayer 路径",
    settings: "设置",
    platformSettings: "平台设置",
    language: "语言",
    exit: "退出",
    current: "当前",
    outputDirectoryFallback: "输出目录编辑暂时请使用行输入兼容模式。",
    selectPlatformLogin: "选择要登录的平台",
    openingBrowserLogin: "正在打开浏览器登录页",
    potPlayerSaved: "PotPlayer 路径已保存。",
    potPlayerCancelled: "PotPlayer 路径编辑已取消。",
    platformEntrySaved: "平台入口已保存。",
    platformEntryCancelled: "平台入口编辑已取消。",
    platformEntryInvalid: "请至少输入一个平台入口 URL。",
    noPreviousResult: "没有上一次结果。",
    resolving: "正在解析 CS2 赛事流...",
    openedPotPlayer: "已用 PotPlayer 打开",
    openedAssociation: "已使用 Windows 文件关联打开播放列表。",
    openFailed: "无法自动打开播放列表",
    playlistAvailable: "播放列表仍保留在",
    douyu: "斗鱼",
    huya: "虎牙",
    editDouyu: "编辑斗鱼入口",
    editHuya: "编辑虎牙入口",
    editBilibili: "编辑 Bilibili 入口",
  },
};
