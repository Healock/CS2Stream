#!/usr/bin/env node
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
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

  program
    .option("-a, --anchor <url>", "Douyu anchor URL or room ID", "https://www.douyu.com/601514")
    .option("-o, --output-dir <path>", "Playlist output directory", "out")
    .option("--prefix-titles", "Prefix playlist item titles with the event title")
    .action(async (options: { anchor: string; outputDir: string; prefixTitles?: boolean }) => {
      const result = await resolve({
        anchor: options.anchor,
        outputDir: options.outputDir,
        prefixTitles: Boolean(options.prefixTitles),
      });

      io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      program.setOptionValue("__exitCode", result.ok ? 0 : 1);
    });

  await program.parseAsync(argv);
  return program.getOptionValue("__exitCode") as number | undefined ?? 0;
}

if (isDirectExecution()) {
  process.exitCode = await runCli(process.argv, { stdout: process.stdout });
}

function isDirectExecution(): boolean {
  return Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === resolvePath(process.argv[1]);
}
