#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { isDirectExecutionPath } from "./direct-execution.js";
import { openPlaylistInPotPlayer, type OpenPlaylistResult } from "./potplayer.js";
import { runResolver, type RunResolverOptions } from "./resolver.js";
import { LineQuestionQueue } from "./tui/line-queue.js";
import {
  createInitialTuiState,
  parseLanguageSelection,
  parseMenuAction,
  renderInvalidLanguageMessage,
  renderInvalidOptionMessage,
  renderLanguageChangedMessage,
  renderLanguagePrompt,
  renderMainMenu,
  renderNoPreviousResultMessage,
  renderPlaceholderMessage,
  renderResolvingMessage,
  renderResultSummary,
  renderSelectOptionPrompt,
  type TuiState,
} from "./tui/menu.js";
import type { ResolverResult } from "./types.js";

export interface TuiIo {
  write(chunk: string): void;
  question(prompt: string): Promise<string | undefined>;
  close(): void;
}

export type TuiResolveFn = (options: RunResolverOptions) => Promise<ResolverResult>;
export type TuiOpenPlaylistFn = (playlistPath: string, options: { explicitPath?: string }) => OpenPlaylistResult;

export interface RunTuiOptions {
  io?: TuiIo;
  resolve?: TuiResolveFn;
  openPlaylist?: TuiOpenPlaylistFn;
}

export async function runTui(options: RunTuiOptions = {}): Promise<number> {
  const io = options.io ?? createDefaultIo();
  const resolve = options.resolve ?? runResolver;
  const openPlaylist = options.openPlaylist ?? openPlaylistInPotPlayer;
  const state = createInitialTuiState();

  try {
    let shouldExit = false;
    while (!shouldExit) {
      io.write(renderMainMenu(state));
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
          io.write(state.lastResult ? `${renderResultSummary(state.lastResult, state.language)}\n` : `${renderNoPreviousResultMessage(state.language)}\n`);
          break;
        case "set-potplayer-path":
          state.potPlayerPath = await promptOptionalValue(io, "PotPlayer executable path: ");
          break;
        case "set-anchor":
          state.anchor = await promptRequiredValue(io, "Douyu anchor URL or room ID: ", state.anchor);
          break;
        case "set-output-dir":
          state.outputDir = await promptRequiredValue(io, "Output directory: ", state.outputDir);
          break;
        case "auth-settings":
          io.write(`${renderPlaceholderMessage("auth-settings", state.language)}\n`);
          break;
        case "platform-settings":
          io.write(`${renderPlaceholderMessage("platform-settings", state.language)}\n`);
          break;
        case "set-language":
          await setLanguage(state, io);
          break;
        case "exit":
          shouldExit = true;
          break;
        case "invalid":
          io.write(`${renderInvalidOptionMessage(state.language)}\n`);
          break;
      }
    }

    return 0;
  } finally {
    io.close();
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
    io.write(`${renderInvalidLanguageMessage(state.language)}\n`);
    return;
  }

  state.language = language;
  io.write(`${renderLanguageChangedMessage(state.language)}\n`);
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
    anchor: state.anchor,
    outputDir: state.outputDir,
    cleanStreamFilter: state.cleanStreamFilter,
  });
  state.lastResult = result;
  io.write(`${renderResultSummary(result, state.language)}\n`);

  if (!shouldOpen || !result.ok || !result.playlistPath) {
    return;
  }

  const launchResult = openPlaylist(result.playlistPath, { explicitPath: state.potPlayerPath });
  if (launchResult.ok && launchResult.mode === "potplayer") {
    io.write(`Opened in PotPlayer: ${launchResult.executablePath}\n`);
  } else if (launchResult.ok) {
    io.write("Opened playlist using Windows file association.\n");
  } else {
    io.write(`Could not open playlist automatically: ${launchResult.error}\n`);
    io.write(`Playlist remains available at: ${result.playlistPath}\n`);
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
  process.exitCode = await runTui();
}
