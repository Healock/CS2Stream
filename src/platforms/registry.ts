import type { PlatformAdapter } from "./types.js";

export function findPlatformAdapter(input: string, adapters: PlatformAdapter[]): PlatformAdapter | undefined {
  return adapters.find((adapter) => adapter.detect(input));
}
