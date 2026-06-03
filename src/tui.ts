#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { isDirectExecutionPath } from "./direct-execution.js";
import { openPlaylistInPotPlayer, type OpenPlaylistResult } from "./potplayer.js";
import { runResolver, type RunResolverOptions } from "./resolver.js";
import {
  createInitialTuiState,
  parseMenuAction,
  renderMainMenu,
  renderPlaceholderMessage,
  renderResultSummary,
  type TuiState,
} from "./tui/menu.js";
import type { ResolverResult } from "./types.js";

export interface TuiIo {
  write(chunk: string): void;
  question(prompt: string): Promise<string>;
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
      const choice = await askMenuChoice(io);
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
          io.write(state.lastResult ? `${renderResultSummary(state.lastResult)}\n` : "No previous result.\n");
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
          io.write(`${renderPlaceholderMessage("auth-settings")}\n`);
          break;
        case "platform-settings":
          io.write(`${renderPlaceholderMessage("platform-settings")}\n`);
          break;
        case "exit":
          shouldExit = true;
          break;
        case "invalid":
          io.write("Invalid option.\n");
          break;
      }
    }

    return 0;
  } finally {
    io.close();
  }
}

async function askMenuChoice(io: TuiIo): Promise<string | undefined> {
  try {
    return await io.question("Select option: ");
  } catch (error) {
    if (isInputClosedError(error)) {
      return undefined;
    }

    throw error;
  }
}

async function resolveAndMaybeOpen(
  state: TuiState,
  io: TuiIo,
  resolve: TuiResolveFn,
  openPlaylist: TuiOpenPlaylistFn,
  shouldOpen: boolean
): Promise<void> {
  io.write("Resolving Douyu CS2 rooms...\n");
  const result = await resolve({ anchor: state.anchor, outputDir: state.outputDir });
  state.lastResult = result;
  io.write(`${renderResultSummary(result)}\n`);

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
  const value = (await io.question(prompt)).trim();
  return value || undefined;
}

async function promptRequiredValue(io: TuiIo, prompt: string, fallback: string): Promise<string> {
  const value = (await io.question(prompt)).trim();
  return value || fallback;
}

function createDefaultIo(): TuiIo {
  const readline = createInterface({ input, output });
  return {
    write(chunk) {
      output.write(chunk);
    },
    question(prompt) {
      return readline.question(prompt);
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
