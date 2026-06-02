#!/usr/bin/env node
import { Command } from "commander";
import { runResolver } from "./resolver.js";

const program = new Command();

program
  .option("-a, --anchor <url>", "Douyu anchor URL or room ID", "https://www.douyu.com/601514")
  .option("-o, --output-dir <path>", "Playlist output directory", "out")
  .option("--prefix-titles", "Prefix playlist item titles with the event title")
  .action(async (options: { anchor: string; outputDir: string; prefixTitles?: boolean }) => {
    const result = await runResolver({
      anchor: options.anchor,
      outputDir: options.outputDir,
      prefixTitles: Boolean(options.prefixTitles),
    });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.ok ? 0 : 1;
  });

await program.parseAsync();
