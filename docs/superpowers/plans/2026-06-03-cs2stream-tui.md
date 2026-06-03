# cs2stream TUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `cs2stream` command that opens a menu-driven TUI around the existing Douyu CS2 resolver and can open the generated PotPlayer playlist.

**Architecture:** Keep stream resolution in `runResolver()` and add thin interactive modules around it. Pure menu formatting and PotPlayer command selection are tested separately from terminal I/O, while `src/tui.ts` wires readline, resolver calls, and launch behavior.

**Tech Stack:** Node.js 20 ESM, TypeScript, Vitest, built-in `readline/promises`, built-in `child_process`, built-in `fs`.

---

## File Structure

- Create `src/tui/menu.ts`: pure TUI state, menu text, input action parsing, and result summary formatting.
- Create `src/potplayer.ts`: PotPlayer executable detection and playlist launch helper with injectable dependencies.
- Create `src/tui.ts`: executable menu loop using `readline/promises`, `runResolver()`, and `openPlaylistInPotPlayer()`.
- Modify `package.json`: expose `cs2stream` as `./dist/tui.js`.
- Create `tests/tui-menu.test.ts`: tests menu rendering, input routing, result summaries, and placeholder output.
- Create `tests/potplayer.test.ts`: tests PotPlayer detection and launch behavior.
- Modify or create `tests/package-bin.test.ts`: verifies `cs2stream` is registered in `package.json`.
- Modify `README.md`: document `npm link`, `cs2stream`, and fallback CLI usage.

## Task 1: Menu State, Rendering, And Action Parsing

**Files:**
- Create: `src/tui/menu.ts`
- Create: `tests/tui-menu.test.ts`

- [ ] **Step 1: Write failing tests for menu rendering and numeric action parsing**

Add `tests/tui-menu.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  createInitialTuiState,
  parseMenuAction,
  renderMainMenu,
} from "../src/tui/menu.js";

describe("TUI menu", () => {
  test("renders default Douyu CS2 state", () => {
    const menu = renderMainMenu(createInitialTuiState());

    expect(menu).toContain("CS2 Stream Assistant");
    expect(menu).toContain("Anchor: https://www.douyu.com/601514");
    expect(menu).toContain("Output: out");
    expect(menu).toContain("PotPlayer: auto");
    expect(menu).toContain("1. Resolve Douyu CS2 and open in PotPlayer");
    expect(menu).toContain("8. Other platform settings");
    expect(menu).toContain("0. Exit");
  });

  test.each([
    ["1", "resolve-and-open"],
    ["2", "resolve-only"],
    ["3", "show-last-result"],
    ["4", "set-potplayer-path"],
    ["5", "set-anchor"],
    ["6", "set-output-dir"],
    ["7", "auth-settings"],
    ["8", "platform-settings"],
    ["0", "exit"],
  ] as const)("maps input %s to %s", (input, action) => {
    expect(parseMenuAction(input)).toBe(action);
  });

  test("trims input before parsing", () => {
    expect(parseMenuAction(" 1 ")).toBe("resolve-and-open");
  });

  test("returns invalid for unknown menu choices", () => {
    expect(parseMenuAction("9")).toBe("invalid");
    expect(parseMenuAction("abc")).toBe("invalid");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- tests/tui-menu.test.ts
```

Expected: fail because `src/tui/menu.ts` does not exist.

- [ ] **Step 3: Implement minimal menu module**

Create `src/tui/menu.ts`:

```ts
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
```

- [ ] **Step 4: Run menu tests to verify they pass**

Run:

```powershell
npm test -- tests/tui-menu.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/tui/menu.ts tests/tui-menu.test.ts
git commit -m "feat: add cs2stream menu model"
```

## Task 2: Result Summary Formatting And Placeholder Text

**Files:**
- Modify: `src/tui/menu.ts`
- Modify: `tests/tui-menu.test.ts`

- [ ] **Step 1: Write failing tests for resolver result summaries**

Append to `tests/tui-menu.test.ts`:

```ts
import type { ResolverResult } from "../src/types.js";
import {
  renderPlaceholderMessage,
  renderResultSummary,
} from "../src/tui/menu.js";

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
    expect(summary).toContain("- 副舞台: offline");
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
    expect(renderPlaceholderMessage("auth-settings")).toContain("Account authentication settings are reserved");
    expect(renderPlaceholderMessage("platform-settings")).toContain("Huya and Bilibili support is reserved");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- tests/tui-menu.test.ts
```

Expected: fail because `renderResultSummary` and `renderPlaceholderMessage` are not exported.

- [ ] **Step 3: Implement summary helpers**

Add to `src/tui/menu.ts`:

```ts
export function renderResultSummary(result: ResolverResult): string {
  const lines: string[] = [];

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

export function renderPlaceholderMessage(action: "auth-settings" | "platform-settings"): string {
  if (action === "auth-settings") {
    return "Account authentication settings are reserved for a later version.";
  }

  return "Huya and Bilibili support is reserved for a later version.";
}
```

- [ ] **Step 4: Run menu tests to verify they pass**

Run:

```powershell
npm test -- tests/tui-menu.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/tui/menu.ts tests/tui-menu.test.ts
git commit -m "feat: format cs2stream results"
```

## Task 3: PotPlayer Detection And Launch Helper

**Files:**
- Create: `src/potplayer.ts`
- Create: `tests/potplayer.test.ts`

- [ ] **Step 1: Write failing tests for PotPlayer path detection and launch fallback**

Create `tests/potplayer.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";
import {
  COMMON_POTPLAYER_PATHS,
  findPotPlayerPath,
  openPlaylistInPotPlayer,
} from "../src/potplayer.js";

describe("PotPlayer integration", () => {
  test("uses explicit executable path when it exists", () => {
    const exists = (path: string) => path === "C:\\Tools\\PotPlayerMini64.exe";

    expect(findPotPlayerPath({ explicitPath: "C:\\Tools\\PotPlayerMini64.exe", exists })).toBe("C:\\Tools\\PotPlayerMini64.exe");
  });

  test("ignores explicit path when it does not exist and finds common path", () => {
    const exists = (path: string) => path === COMMON_POTPLAYER_PATHS[1];

    expect(findPotPlayerPath({ explicitPath: "C:\\Missing\\PotPlayer.exe", exists })).toBe(COMMON_POTPLAYER_PATHS[1]);
  });

  test("returns undefined when no executable exists", () => {
    expect(findPotPlayerPath({ exists: () => false })).toBeUndefined();
  });

  test("launches playlist with detected PotPlayer executable", () => {
    const spawn = vi.fn();
    const result = openPlaylistInPotPlayer("out\\科隆MAJOR.dpl", {
      explicitPath: "C:\\Tools\\PotPlayerMini64.exe",
      exists: (path) => path === "C:\\Tools\\PotPlayerMini64.exe",
      spawn,
    });

    expect(result).toEqual({ ok: true, mode: "potplayer", executablePath: "C:\\Tools\\PotPlayerMini64.exe" });
    expect(spawn).toHaveBeenCalledWith("C:\\Tools\\PotPlayerMini64.exe", ["out\\科隆MAJOR.dpl"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
  });

  test("falls back to Windows file association when PotPlayer is not found", () => {
    const spawn = vi.fn();
    const result = openPlaylistInPotPlayer("out\\科隆MAJOR.dpl", {
      exists: () => false,
      spawn,
    });

    expect(result).toEqual({ ok: true, mode: "file-association" });
    expect(spawn).toHaveBeenCalledWith("cmd.exe", ["/c", "start", "", "out\\科隆MAJOR.dpl"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
  });

  test("reports launch errors without throwing", () => {
    const result = openPlaylistInPotPlayer("out\\科隆MAJOR.dpl", {
      exists: () => false,
      spawn: () => {
        throw new Error("spawn failed");
      },
    });

    expect(result).toEqual({ ok: false, mode: "file-association", error: "spawn failed" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- tests/potplayer.test.ts
```

Expected: fail because `src/potplayer.ts` does not exist.

- [ ] **Step 3: Implement PotPlayer helper**

Create `src/potplayer.ts`:

```ts
import { existsSync } from "node:fs";
import { spawn as spawnChildProcess } from "node:child_process";

export const COMMON_POTPLAYER_PATHS = [
  "C:\\Program Files\\DAUM\\PotPlayer\\PotPlayerMini64.exe",
  "C:\\Program Files\\DAUM\\PotPlayer\\PotPlayerMini.exe",
  "C:\\Program Files (x86)\\DAUM\\PotPlayer\\PotPlayerMini.exe",
] as const;

export interface FindPotPlayerPathOptions {
  explicitPath?: string;
  exists?: (path: string) => boolean;
}

export interface OpenPlaylistOptions extends FindPotPlayerPathOptions {
  spawn?: SpawnFn;
}

export type SpawnFn = (
  command: string,
  args: string[],
  options: { detached: true; stdio: "ignore"; windowsHide: true }
) => { unref?: () => void } | void;

export type OpenPlaylistResult =
  | { ok: true; mode: "potplayer"; executablePath: string }
  | { ok: true; mode: "file-association" }
  | { ok: false; mode: "potplayer" | "file-association"; executablePath?: string; error: string };

export function findPotPlayerPath(options: FindPotPlayerPathOptions = {}): string | undefined {
  const exists = options.exists ?? existsSync;

  if (options.explicitPath && exists(options.explicitPath)) {
    return options.explicitPath;
  }

  return COMMON_POTPLAYER_PATHS.find((path) => exists(path));
}

export function openPlaylistInPotPlayer(playlistPath: string, options: OpenPlaylistOptions = {}): OpenPlaylistResult {
  const spawn = options.spawn ?? spawnChildProcess;
  const executablePath = findPotPlayerPath(options);

  if (executablePath) {
    try {
      const child = spawn(executablePath, [playlistPath], launchOptions());
      child?.unref?.();
      return { ok: true, mode: "potplayer", executablePath };
    } catch (error) {
      return { ok: false, mode: "potplayer", executablePath, error: errorMessage(error) };
    }
  }

  try {
    const child = spawn("cmd.exe", ["/c", "start", "", playlistPath], launchOptions());
    child?.unref?.();
    return { ok: true, mode: "file-association" };
  } catch (error) {
    return { ok: false, mode: "file-association", error: errorMessage(error) };
  }
}

function launchOptions(): { detached: true; stdio: "ignore"; windowsHide: true } {
  return {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

- [ ] **Step 4: Run PotPlayer tests to verify they pass**

Run:

```powershell
npm test -- tests/potplayer.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/potplayer.ts tests/potplayer.test.ts
git commit -m "feat: add potplayer playlist launcher"
```

## Task 4: TUI Entrypoint And Interactive Loop

**Files:**
- Create: `src/tui.ts`
- Create: `tests/tui.test.ts`

- [ ] **Step 1: Write failing tests for scripted TUI sessions**

Create `tests/tui.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- tests/tui.test.ts
```

Expected: fail because `src/tui.ts` does not exist.

- [ ] **Step 3: Implement TUI entrypoint**

Create `src/tui.ts`:

```ts
#!/usr/bin/env node
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { runResolver, type RunResolverOptions } from "./resolver.js";
import { openPlaylistInPotPlayer, type OpenPlaylistResult } from "./potplayer.js";
import type { ResolverResult } from "./types.js";
import {
  createInitialTuiState,
  parseMenuAction,
  renderMainMenu,
  renderPlaceholderMessage,
  renderResultSummary,
  type TuiState,
} from "./tui/menu.js";

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
      const choice = await io.question("Select option: ");

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

function isDirectExecution(): boolean {
  return Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === resolvePath(process.argv[1]);
}

if (isDirectExecution()) {
  process.exitCode = await runTui();
}
```

- [ ] **Step 4: Run TUI tests to verify they pass**

Run:

```powershell
npm test -- tests/tui.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/tui.ts tests/tui.test.ts
git commit -m "feat: add cs2stream tui loop"
```

## Task 5: Register `cs2stream` Binary

**Files:**
- Modify: `package.json`
- Create: `tests/package-bin.test.ts`

- [ ] **Step 1: Write failing test for binary registration**

Create `tests/package-bin.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("package binaries", () => {
  test("exposes cs2stream command", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      bin?: Record<string, string>;
    };

    expect(packageJson.bin?.cs2stream).toBe("./dist/tui.js");
    expect(packageJson.bin?.["douyu-cs2-potplayer"]).toBe("./dist/cli.js");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- tests/package-bin.test.ts
```

Expected: fail because `bin.cs2stream` is missing.

- [ ] **Step 3: Add `cs2stream` to `package.json`**

Change the `bin` field in `package.json` to:

```json
"bin": {
  "cs2stream": "./dist/tui.js",
  "douyu-cs2-potplayer": "./dist/cli.js"
}
```

- [ ] **Step 4: Run binary registration test**

Run:

```powershell
npm test -- tests/package-bin.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add package.json tests/package-bin.test.ts
git commit -m "feat: register cs2stream command"
```

## Task 6: Documentation And Full Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README usage**

Replace the usage section with content that includes:

```md
## Usage

Run commands from the repository root in Windows PowerShell:

```powershell
npm install
npm run build
npm link
cs2stream
```

`cs2stream` opens a menu. The default option resolves the current Douyu CS2 event from `https://www.douyu.com/601514`, writes a `.dpl` playlist, and opens it in PotPlayer when PotPlayer can be located.

If automatic launch fails, use the playlist path shown in the TUI and open that `.dpl` manually in PotPlayer. You can also set the PotPlayer executable path from the TUI.

The raw CLI remains available:

```powershell
node dist/cli.js --anchor https://www.douyu.com/601514 --output-dir out
```
```

- [ ] **Step 2: Run full automated verification**

Run:

```powershell
npm test
npm run build
```

Expected: all tests pass and TypeScript builds without errors.

- [ ] **Step 3: Register local command**

Run:

```powershell
npm link
```

Expected: command registration completes successfully.

- [ ] **Step 4: Smoke test `cs2stream` command**

Run:

```powershell
"0" | cs2stream
```

Expected: menu prints once and exits with code 0.

- [ ] **Step 5: Commit**

Run:

```powershell
git add README.md package-lock.json
git commit -m "docs: document cs2stream usage"
```

Only include `package-lock.json` if `npm link` or package metadata changes touched it.

