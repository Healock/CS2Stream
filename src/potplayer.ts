import { spawn as spawnChildProcess } from "node:child_process";
import { existsSync } from "node:fs";

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
