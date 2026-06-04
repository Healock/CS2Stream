import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("package binaries", () => {
  test("exposes cs2stream command", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      name?: string;
      bin?: Record<string, string>;
    };

    expect(packageJson.name).toBe("cs2stream");
    expect(packageJson.bin?.cs2stream).toBe("./dist/tui.js");
    expect(packageJson.bin?.["cs2stream-cli"]).toBe("./dist/cli.js");
    expect(packageJson.bin?.["douyu-cs2-potplayer"]).toBeUndefined();
  });

  test("publishes only runtime package files", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      files?: string[];
    };

    expect(packageJson.files).toEqual(["dist", "README.md"]);
  });
});
