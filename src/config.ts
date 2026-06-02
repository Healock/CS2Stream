export interface ResolverConfig {
  anchor: string;
  outputDir: string;
  timeoutMs: number;
  prefixTitles: boolean;
}

export function createDefaultConfig(overrides: Partial<ResolverConfig> = {}): ResolverConfig {
  return {
    anchor: "https://www.douyu.com/601514",
    outputDir: "out",
    timeoutMs: 15000,
    prefixTitles: false,
    ...overrides,
  };
}
