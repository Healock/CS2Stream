import { realpathSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

export interface DirectExecutionOptions {
  realpath?: (path: string) => string;
}

export function isDirectExecutionPath(argvPath: string | undefined, moduleUrl: string, options: DirectExecutionOptions = {}): boolean {
  if (!argvPath) {
    return false;
  }

  const realpath = options.realpath ?? realpathSync.native;
  return normalizeComparablePath(realpath(resolvePath(argvPath))) === normalizeComparablePath(realpath(fileURLToPath(moduleUrl)));
}

function normalizeComparablePath(path: string): string {
  return path.replaceAll("\\", "/").toLowerCase();
}
