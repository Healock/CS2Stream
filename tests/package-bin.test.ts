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
