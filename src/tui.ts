#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { ProcessTerminal, TUI } from "@earendil-works/pi-tui";
import { isDirectExecutionPath } from "./direct-execution.js";
import { createPiTuiApp } from "./pi-tui-app.js";
import { capturePlatformBrowserCookies } from "./browser-auth.js";
import { openPlaylistInPotPlayer, type OpenPlaylistResult } from "./potplayer.js";
import { getSelectedPlatformAnchors, parseAnchorList } from "./platform-config.js";
import { runResolver, type RunResolverOptions } from "./resolver.js";
import { LineQuestionQueue } from "./tui/line-queue.js";
import {
  createInitialTuiState,
  parseAuthPlatformSelection,
  parseLanguageSelection,
  parseMenuAction,
  parsePlatformSettingsAction,
  parseSettingsAction,
  platformFromEditAction,
  platformFromToggleAction,
  renderCleanStreamFilterChangedMessage,
  renderAuthPlatformPrompt,
  renderBrowserAuthFailedMessage,
  renderInvalidLanguageMessage,
  renderInvalidOptionMessage,
  renderLanguageChangedMessage,
  renderLanguagePrompt,
  renderMainMenu,
  renderNoPreviousResultMessage,
  renderPlaceholderMessage,
  renderPlatformCookieCapturedMessage,
  renderPlatformSettingsMenu,
  renderPlatformToggleMessage,
  renderResolvingMessage,
  renderResultSummary,
  renderSelectOptionPrompt,
  renderSettingsMenu,
  type TuiState,
} from "./tui/menu.js";
import type { ResolverResult } from "./types.js";
import type { PlatformId } from "./types.js";

export interface TuiIo {
  write(chunk: string): void;
  question(prompt: string): Promise<string | undefined>;
  clear?(): void;
  close(): void;
}

export type TuiResolveFn = (options: RunResolverOptions) => Promise<ResolverResult>;
export type TuiOpenPlaylistFn = (playlistPath: string, options: { explicitPath?: string }) => OpenPlaylistResult;
export type CaptureBrowserCookiesFn = (platform: PlatformId) => Promise<string>;

export interface RunTuiOptions {
  io?: TuiIo;
  resolve?: TuiResolveFn;
  openPlaylist?: TuiOpenPlaylistFn;
  captureBrowserCookies?: CaptureBrowserCookiesFn;
}

export async function runTui(options: RunTuiOptions = {}): Promise<number> {
  const io = options.io ?? createDefaultIo();
  const resolve = options.resolve ?? runResolver;
  const openPlaylist = options.openPlaylist ?? openPlaylistInPotPlayer;
  const captureBrowserCookies = options.captureBrowserCookies ?? capturePlatformBrowserCookies;
  const state = createInitialTuiState();

  try {
    let shouldExit = false;
    while (!shouldExit) {
      renderMainScreen(state, io);
      const choice = await askQuestion(io, renderSelectOptionPrompt(state.language));
      if (choice === undefined) {
        break;
      }

      switch (parseMenuAction(choice)) {
        case "resolve-and-open":
          await resolveAndMaybeOpen(state, io, resolve, openPlaylist, true);
          break;
        case "resolve-only":
          await resolveAndMaybeOpen(state, io, resolve, openPlaylist, false);
          break;
        case "show-last-result":
          state.statusMessage = state.lastResult ? renderResultSummary(state.lastResult, state.language) : renderNoPreviousResultMessage(state.language);
          break;
        case "settings":
          await openSettingsMenu(state, io, captureBrowserCookies);
          break;
        case "platform-settings":
          await openPlatformSettingsMenu(state, io);
          break;
        case "set-language":
          await setLanguage(state, io);
          break;
        case "exit":
          shouldExit = true;
          break;
        case "invalid":
          state.statusMessage = renderInvalidOptionMessage(state.language);
          break;
      }
    }

    return 0;
  } finally {
    io.close();
  }
}

async function openSettingsMenu(state: TuiState, io: TuiIo, captureBrowserCookies: CaptureBrowserCookiesFn): Promise<void> {
  let shouldReturn = false;
  while (!shouldReturn) {
    renderSettingsScreen(state, io);
    const choice = await askQuestion(io, renderSelectOptionPrompt(state.language));
    if (choice === undefined) {
      return;
    }

    switch (parseSettingsAction(choice)) {
      case "set-output-dir":
        state.outputDir = await promptRequiredValue(io, "Output directory: ", state.outputDir);
        break;
      case "toggle-clean-stream-filter":
        state.cleanStreamFilter = state.cleanStreamFilter === "clean-only" ? "all" : "clean-only";
        state.statusMessage = renderCleanStreamFilterChangedMessage(state.cleanStreamFilter, state.language);
        break;
      case "set-potplayer-path":
        state.potPlayerPath = await promptOptionalValue(io, "PotPlayer executable path: ");
        break;
      case "auth-settings":
        await captureAuthCookies(state, io, captureBrowserCookies);
        break;
      case "back":
        shouldReturn = true;
        break;
      case "invalid":
        state.statusMessage = renderInvalidOptionMessage(state.language);
        break;
    }
  }
}

async function openPlatformSettingsMenu(state: TuiState, io: TuiIo): Promise<void> {
  let shouldReturn = false;
  while (!shouldReturn) {
    renderPlatformSettingsScreen(state, io);
    const choice = await askQuestion(io, renderSelectOptionPrompt(state.language));
    if (choice === undefined) {
      return;
    }

    const action = parsePlatformSettingsAction(choice);
    const togglePlatform = platformFromToggleAction(action);
    if (togglePlatform) {
      state.platformSelection[togglePlatform] = !state.platformSelection[togglePlatform];
      state.statusMessage = renderPlatformToggleMessage(togglePlatform, state.platformSelection[togglePlatform], state.language);
      continue;
    }

    const editPlatform = platformFromEditAction(action);
    if (editPlatform) {
      const current = state.platformAnchors[editPlatform].join(", ");
      const value = await promptRequiredValue(io, "Entry URL(s), comma separated: ", current);
      const anchors = parseAnchorList(value);
      if (anchors.length > 0) {
        state.platformAnchors[editPlatform] = anchors;
      }
      continue;
    }

    switch (action) {
      case "back":
        shouldReturn = true;
        break;
      case "invalid":
        state.statusMessage = renderInvalidOptionMessage(state.language);
        break;
    }
  }
}

function renderMainScreen(state: TuiState, io: TuiIo): void {
  io.clear?.();
  io.write(renderMainMenu(state));
  writeStatusMessage(state, io);
}

function renderSettingsScreen(state: TuiState, io: TuiIo): void {
  io.clear?.();
  io.write(renderSettingsMenu(state));
  writeStatusMessage(state, io);
}

function renderPlatformSettingsScreen(state: TuiState, io: TuiIo): void {
  io.clear?.();
  io.write(renderPlatformSettingsMenu(state));
  writeStatusMessage(state, io);
}

function writeStatusMessage(state: TuiState, io: TuiIo): void {
  if (state.statusMessage) {
    io.write(`${state.statusMessage}\n\n`);
  }
}

async function askQuestion(io: TuiIo, prompt: string): Promise<string | undefined> {
  try {
    return await io.question(prompt);
  } catch (error) {
    if (isInputClosedError(error)) {
      return undefined;
    }

    throw error;
  }
}

async function setLanguage(state: TuiState, io: TuiIo): Promise<void> {
  const input = await askQuestion(io, renderLanguagePrompt(state.language));
  if (input === undefined) {
    return;
  }

  const language = parseLanguageSelection(input);

  if (!language) {
    state.statusMessage = renderInvalidLanguageMessage(state.language);
    return;
  }

  state.language = language;
  state.statusMessage = renderLanguageChangedMessage(state.language);
}

async function captureAuthCookies(
  state: TuiState,
  io: TuiIo,
  captureBrowserCookies: CaptureBrowserCookiesFn
): Promise<void> {
  const input = await askQuestion(io, renderAuthPlatformPrompt(state.language));
  if (input === undefined) {
    return;
  }

  const platform = parseAuthPlatformSelection(input);
  if (!platform || platform === "back") {
    if (!platform) {
      state.statusMessage = renderInvalidOptionMessage(state.language);
    }
    return;
  }

  try {
    const cookieHeader = await captureBrowserCookies(platform);
    state.platformCookieHeaders[platform] = cookieHeader;
    state.statusMessage = renderPlatformCookieCapturedMessage(platform, state.language);
  } catch (error) {
    state.statusMessage = renderBrowserAuthFailedMessage(error, state.language);
  }
}

async function resolveAndMaybeOpen(
  state: TuiState,
  io: TuiIo,
  resolve: TuiResolveFn,
  openPlaylist: TuiOpenPlaylistFn,
  shouldOpen: boolean
): Promise<void> {
  io.write(renderResolvingMessage(state.language));
  const result = await resolve({
    anchors: getSelectedPlatformAnchors(state.platformSelection, state.platformAnchors),
    outputDir: state.outputDir,
    cleanStreamFilter: state.cleanStreamFilter,
    ...(Object.keys(state.platformCookieHeaders).length > 0 ? { platformCookieHeaders: state.platformCookieHeaders } : {}),
  });
  state.lastResult = result;
  state.statusMessage = renderResultSummary(result, state.language);

  if (!shouldOpen || !result.ok || !result.playlistPath) {
    return;
  }

  const launchResult = openPlaylist(result.playlistPath, { explicitPath: state.potPlayerPath });
  if (launchResult.ok && launchResult.mode === "potplayer") {
    state.statusMessage = `${state.statusMessage}\nOpened in PotPlayer: ${launchResult.executablePath}`;
  } else if (launchResult.ok) {
    state.statusMessage = `${state.statusMessage}\nOpened playlist using Windows file association.`;
  } else {
    state.statusMessage = `${state.statusMessage}\nCould not open playlist automatically: ${launchResult.error}\nPlaylist remains available at: ${result.playlistPath}`;
  }
}

async function promptOptionalValue(io: TuiIo, prompt: string): Promise<string | undefined> {
  const input = await askQuestion(io, prompt);
  if (input === undefined) {
    return undefined;
  }

  const value = input.trim();
  return value || undefined;
}

async function promptRequiredValue(io: TuiIo, prompt: string, fallback: string): Promise<string> {
  const input = await askQuestion(io, prompt);
  if (input === undefined) {
    return fallback;
  }

  const value = input.trim();
  return value || fallback;
}

function createDefaultIo(): TuiIo {
  const readline = createInterface({ input, output, terminal: input.isTTY && output.isTTY });
  const queue = new LineQuestionQueue();
  readline.on("line", (line) => {
    queue.pushLine(line);
  });
  readline.on("close", () => {
    queue.close();
  });

  return {
    write(chunk) {
      output.write(chunk);
    },
    clear() {
      if (input.isTTY && output.isTTY) {
        output.write("\x1b[2J\x1b[H");
      }
    },
    async question(prompt) {
      output.write(prompt);
      return await queue.question();
    },
    close() {
      readline.close();
    },
  };
}

function isInputClosedError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error.code === "ERR_USE_AFTER_CLOSE" || error.code === "ERR_STREAM_PREMATURE_CLOSE");
}

function isDirectExecution(): boolean {
  return isDirectExecutionPath(process.argv[1], import.meta.url);
}

if (isDirectExecution()) {
  if (input.isTTY && output.isTTY) {
    const terminal = new ProcessTerminal();
    const tui = new TUI(terminal);
    const app = createPiTuiApp({ exit: () => tui.stop(), requestRender: () => tui.requestRender(true) });
    tui.addChild(app);
    tui.setFocus(app);
    tui.start();
  } else {
    process.exitCode = await runTui();
  }
}
