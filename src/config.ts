export interface ResolverConfig {
  anchor: string;
  outputDir: string;
  timeoutMs: number;
  prefixTitles: boolean;
  streamConcurrency: number;
  cleanStreamFilter: "clean-only" | "all";
}

export function createDefaultConfig(overrides: Partial<ResolverConfig> = {}): ResolverConfig {
  const config = {
    anchor: "https://www.douyu.com/601514",
    outputDir: "out",
    timeoutMs: 15000,
    prefixTitles: false,
    streamConcurrency: 3,
    cleanStreamFilter: "clean-only" as const,
    ...overrides,
  };

  return {
    ...config,
    streamConcurrency: normalizePositiveInteger(config.streamConcurrency, 3),
    cleanStreamFilter: normalizeCleanStreamFilter(config.cleanStreamFilter),
  };
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback;
}

function normalizeCleanStreamFilter(value: unknown): "clean-only" | "all" {
  return value === "all" ? "all" : "clean-only";
}
