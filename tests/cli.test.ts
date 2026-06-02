import { describe, expect, it } from "vitest";
import { createDefaultConfig } from "../src/config.js";
import { runCli, type ResolveFn } from "../src/cli.js";
import type { RunResolverOptions } from "../src/resolver.js";
import type { ResolverResult } from "../src/types.js";

describe("CLI defaults", () => {
  it("uses room 601514 as the default anchor", () => {
    expect(createDefaultConfig().anchor).toBe("https://www.douyu.com/601514");
  });

  it("passes parsed options to the resolver and prints successful JSON", async () => {
    const calls: RunResolverOptions[] = [];
    const output: string[] = [];
    const fakeResult: ResolverResult = {
      ok: true,
      eventTitle: "科隆MAJOR",
      playlistPath: "tmp-out/科隆MAJOR.dpl",
      rooms: [],
      errors: [],
    };
    const fakeResolver: ResolveFn = async (options) => {
      calls.push(options);
      return fakeResult;
    };

    const code = await runCli(
      ["node", "cli.js", "--anchor", "601514", "--output-dir", "tmp-out", "--prefix-titles"],
      { stdout: { write: (chunk: string) => output.push(chunk) } },
      fakeResolver
    );

    expect(calls).toEqual([{ anchor: "601514", outputDir: "tmp-out", prefixTitles: true }]);
    expect(JSON.parse(output.join(""))).toMatchObject({ ok: true, eventTitle: "科隆MAJOR" });
    expect(output.join("")).toMatch(/\n$/);
    expect(code).toBe(0);
  });

  it("returns failure exit code and prints resolver errors", async () => {
    const output: string[] = [];
    const fakeResolver: ResolveFn = async () => ({
      ok: false,
      rooms: [],
      errors: [{ code: "unsupported_platform", message: "bad" }],
    });

    const code = await runCli(["node", "cli.js"], { stdout: { write: (chunk: string) => output.push(chunk) } }, fakeResolver);
    const json = JSON.parse(output.join(""));

    expect(code).toBe(1);
    expect(json.ok).toBe(false);
    expect(json.errors).toContainEqual({ code: "unsupported_platform", message: "bad" });
  });

  it("returns failure JSON when the resolver rejects", async () => {
    const output: string[] = [];
    const fakeResolver: ResolveFn = async () => {
      throw new Error("resolver exploded");
    };

    const code = await runCli(["node", "cli.js"], { stdout: { write: (chunk: string) => output.push(chunk) } }, fakeResolver);
    const json = JSON.parse(output.join(""));

    expect(code).toBe(1);
    expect(json.ok).toBe(false);
    expect(json.errors).toContainEqual({ code: "network_error", message: "resolver exploded" });
  });
});
