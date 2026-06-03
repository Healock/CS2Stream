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
  | "exit"
  | "invalid";

export interface TuiState {
  anchor: string;
  outputDir: string;
  potPlayerPath?: string;
  lastResult?: ResolverResult;
}

export function createInitialTuiState(): TuiState {
  return {
    anchor: "https://www.douyu.com/601514",
    outputDir: "out",
  };
}

export function renderMainMenu(state: TuiState): string {
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
    case "0":
      return "exit";
    default:
      return "invalid";
  }
}
