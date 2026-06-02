import type { PlatformAdapter } from "./types.js";

export class AmbiguousPlatformError extends Error {
  constructor(input: string, adapterIds: string[]) {
    super(`Ambiguous platform adapter for "${input}": ${adapterIds.join(", ")}`);
    this.name = "AmbiguousPlatformError";
  }
}

export function findPlatformAdapter(input: string, adapters: PlatformAdapter[]): PlatformAdapter | undefined {
  const matches = adapters.filter((adapter) => adapter.detect(input));

  if (matches.length === 0) {
    return undefined;
  }

  if (matches.length > 1) {
    throw new AmbiguousPlatformError(
      input,
      matches.map((adapter) => adapter.id)
    );
  }

  return matches[0];
}
