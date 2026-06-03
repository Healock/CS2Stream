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
