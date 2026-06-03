import { describe, expect, test } from "vitest";
import { isDirectExecutionPath } from "../src/direct-execution.js";

describe("direct execution detection", () => {
  test("matches direct execution when paths are equal after normalization", () => {
    expect(isDirectExecutionPath("D:\\App\\dist\\tui.js", "file:///D:/App/dist/tui.js", {
      realpath: (path) => path,
    })).toBe(true);
  });

  test("matches linked npm bin execution when argv path resolves to module path", () => {
    expect(isDirectExecutionPath(
      "C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\douyu-cs2-potplayer\\dist\\tui.js",
      "file:///D:/Backup/Documents/PotPlayer%20Plugin/dist/tui.js",
      {
        realpath: (path) => path.startsWith("C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\douyu-cs2-potplayer")
          ? path.replace("C:\\Users\\Administrator\\AppData\\Roaming\\npm\\node_modules\\douyu-cs2-potplayer", "D:\\Backup\\Documents\\PotPlayer Plugin")
          : path,
      }
    )).toBe(true);
  });

  test("returns false for different files", () => {
    expect(isDirectExecutionPath("D:\\App\\dist\\cli.js", "file:///D:/App/dist/tui.js", {
      realpath: (path) => path,
    })).toBe(false);
  });
});
