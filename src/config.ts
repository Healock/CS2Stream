export interface ResolverConfig {
  anchor: string;
  anchors: string[];
  outputDir: string;
  timeoutMs: number;
  prefixTitles: boolean;
  streamConcurrency: number;
  cleanStreamFilter: "clean-only" | "all";
}

export const DEFAULT_DOUYU_ANCHOR = "https://www.douyu.com/601514";
export const DEFAULT_HUYA_ANCHORS = [
  "https://www.huya.com/eslcs",
  "https://www.huya.com/eslcsgo2",
  "https://www.huya.com/825801",
  "https://www.huya.com/825802",
] as const;
export const DEFAULT_BILIBILI_ANCHOR = "https://live.bilibili.com/35";
export const DEFAULT_ANCHORS = [
  DEFAULT_DOUYU_ANCHOR,
  ...DEFAULT_HUYA_ANCHORS,
  DEFAULT_BILIBILI_ANCHOR,
] as const;

export function createDefaultConfig(overrides: Partial<ResolverConfig> = {}): ResolverConfig {
  const config = {
    anchor: DEFAULT_DOUYU_ANCHOR,
    anchors: undefined as string[] | undefined,
    outputDir: "out",
    timeoutMs: 15000,
    prefixTitles: false,
    streamConcurrency: 3,
    cleanStreamFilter: "clean-only" as const,
    ...overrides,
  };
  const anchorWasOverridden = Object.hasOwn(overrides, "anchor");

  return {
    ...config,
    anchors: normalizeAnchors(config.anchors, config.anchor, anchorWasOverridden),
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

function normalizeAnchors(value: unknown, anchor: string, anchorWasOverridden: boolean): string[] {
  if (Array.isArray(value)) {
    const anchors = value.map((item) => String(item).trim()).filter((item) => item.length > 0);
    return anchors.length > 0 ? Array.from(new Set(anchors)) : [anchor];
  }

  if (anchorWasOverridden) {
    return [anchor];
  }

  return [...DEFAULT_ANCHORS];
}
