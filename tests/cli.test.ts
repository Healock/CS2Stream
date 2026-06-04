import { describe, expect, it } from "vitest";
import { DEFAULT_ANCHORS, createDefaultConfig } from "../src/config.js";
import { runCli, type ResolveFn } from "../src/cli.js";
import type { RunResolverOptions } from "../src/resolver.js";
import type { ResolverResult } from "../src/types.js";

describe("CLI defaults", () => {
  it("uses room 601514 as the default anchor", () => {
    expect(createDefaultConfig().anchor).toBe("https://www.douyu.com/601514");
  });

  it("uses CS2 platform anchors by default", () => {
    expect(createDefaultConfig().anchors).toEqual([...DEFAULT_ANCHORS]);
    expect(createDefaultConfig().anchors).toContain("https://www.huya.com/eslcs");
    expect(createDefaultConfig({ anchor: "https://www.douyu.com/123" }).anchors).toEqual(["https://www.douyu.com/123"]);
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

    expect(calls).toEqual([{ anchor: "601514", anchors: ["601514"], outputDir: "tmp-out", prefixTitles: true, cleanStreamFilter: "clean-only" }]);
    expect(JSON.parse(output.join(""))).toMatchObject({ ok: true, eventTitle: "科隆MAJOR" });
    expect(output.join("")).toMatch(/\n$/);
    expect(code).toBe(0);
  });

  it("can disable clean-stream-only filtering", async () => {
    const calls: RunResolverOptions[] = [];
    const output: string[] = [];
    const fakeResolver: ResolveFn = async (options) => {
      calls.push(options);
      return { ok: true, rooms: [], errors: [] };
    };

    const code = await runCli(
      ["node", "cli.js", "--all-rooms"],
      { stdout: { write: (chunk: string) => output.push(chunk) } },
      fakeResolver
    );

    expect(code).toBe(0);
    expect(calls).toEqual([{ outputDir: "out", prefixTitles: false, cleanStreamFilter: "all" }]);
  });

  it("supports repeated platform entry anchors", async () => {
    const calls: RunResolverOptions[] = [];
    const fakeResolver: ResolveFn = async (options) => {
      calls.push(options);
      return { ok: true, rooms: [], errors: [] };
    };

    const code = await runCli(
      ["node", "cli.js", "--anchor", "https://www.huya.com/825801", "--anchor", "https://live.bilibili.com/35"],
      { stdout: { write: () => undefined } },
      fakeResolver
    );

    expect(code).toBe(0);
    expect(calls).toEqual([{
      anchor: "https://www.huya.com/825801",
      anchors: ["https://www.huya.com/825801", "https://live.bilibili.com/35"],
      outputDir: "out",
      prefixTitles: false,
      cleanStreamFilter: "clean-only",
    }]);
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

  it("returns structured JSON for unknown options without calling resolver", async () => {
    let called = false;
    const output: string[] = [];
    const fakeResolver: ResolveFn = async () => {
      called = true;
      return { ok: true, rooms: [], errors: [] };
    };

    const code = await runCli(["node", "cli.js", "--definitely-unknown"], { stdout: { write: (chunk: string) => output.push(chunk) } }, fakeResolver);
    const json = JSON.parse(output.join(""));

    expect(code).toBe(1);
    expect(called).toBe(false);
    expect(json.ok).toBe(false);
    expect(json.errors[0]?.code).toBe("network_error");
  });

  it("returns structured JSON for missing option values without calling resolver", async () => {
    let called = false;
    const output: string[] = [];
    const fakeResolver: ResolveFn = async () => {
      called = true;
      return { ok: true, rooms: [], errors: [] };
    };

    const code = await runCli(["node", "cli.js", "--anchor"], { stdout: { write: (chunk: string) => output.push(chunk) } }, fakeResolver);
    const json = JSON.parse(output.join(""));

    expect(code).toBe(1);
    expect(called).toBe(false);
    expect(json.ok).toBe(false);
    expect(json.errors[0]?.code).toBe("network_error");
  });

  it("prints help without calling resolver", async () => {
    let called = false;
    const output: string[] = [];
    const fakeResolver: ResolveFn = async () => {
      called = true;
      return { ok: true, rooms: [], errors: [] };
    };

    const code = await runCli(["node", "cli.js", "--help"], { stdout: { write: (chunk: string) => output.push(chunk) } }, fakeResolver);

    expect(code).toBe(0);
    expect(called).toBe(false);
    expect(output.join("")).toContain("Usage:");
    expect(() => JSON.parse(output.join(""))).toThrow();
  });
});
