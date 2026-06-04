#!/usr/bin/env node
import { Command } from "commander";
import { isDirectExecutionPath } from "./direct-execution.js";
import { runResolver } from "./resolver.js";
import type { RunResolverOptions } from "./resolver.js";
import type { ResolverResult } from "./types.js";

export interface CliIo {
  stdout: {
    write(chunk: string): unknown;
  };
}

export type ResolveFn = (options: RunResolverOptions) => Promise<ResolverResult>;

export async function runCli(argv: string[], io: CliIo, resolve = runResolver): Promise<number> {
  const program = new Command();
  let capturedParseError = "";

  program
    .exitOverride()
    .configureOutput({
      writeOut: (message) => {
        io.stdout.write(message);
      },
      writeErr: (message) => {
        capturedParseError += message;
      },
    })
    .option("-a, --anchor <url>", "CS2 stream entry URL; repeat to override the default platform entries", collectAnchor, [])
    .option("-o, --output-dir <path>", "Playlist output directory", "out")
    .option("--prefix-titles", "Prefix playlist item titles with the event title")
    .option("--all-rooms", "Include rooms even when their titles do not contain 纯净流")
    .action(async (options: { anchor: string[]; outputDir: string; prefixTitles?: boolean; allRooms?: boolean }) => {
      const anchors = options.anchor.map((anchor) => anchor.trim()).filter((anchor) => anchor.length > 0);
      const result = await resolve({
        ...(anchors.length > 0 ? { anchor: anchors[0], anchors } : {}),
        outputDir: options.outputDir,
        prefixTitles: Boolean(options.prefixTitles),
        cleanStreamFilter: options.allRooms ? "all" : "clean-only",
      });

      io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      program.setOptionValue("__exitCode", result.ok ? 0 : 1);
    });

  try {
    await program.parseAsync(argv);
  } catch (error) {
    if (isHelpError(error)) {
      return 0;
    }

    const message = capturedParseError.trim() || errorMessage(error);
    io.stdout.write(`${JSON.stringify({
      ok: false,
      rooms: [],
      errors: [{ code: "network_error", message }],
    }, null, 2)}\n`);
    return 1;
  }

  return program.getOptionValue("__exitCode") as number | undefined ?? 0;
}

if (isDirectExecution()) {
  process.exitCode = await runCli(process.argv, { stdout: process.stdout });
}

function isDirectExecution(): boolean {
  return isDirectExecutionPath(process.argv[1], import.meta.url);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isHelpError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "commander.helpDisplayed";
}

function collectAnchor(value: string, previous: string[]): string[] {
  return [...previous, value];
}
