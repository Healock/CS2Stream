import {
  DEFAULT_BILIBILI_ANCHOR,
  DEFAULT_DOUYU_ANCHOR,
  DEFAULT_HUYA_ANCHORS,
} from "./config.js";
import type { PlatformId } from "./types.js";

export const PLATFORM_ORDER: PlatformId[] = ["douyu", "huya", "bilibili"];

export const PLATFORM_NAMES: Record<PlatformId, { en: string; zh: string }> = {
  douyu: { en: "Douyu", zh: "斗鱼" },
  huya: { en: "Huya", zh: "虎牙" },
  bilibili: { en: "Bilibili", zh: "Bilibili" },
};

export type PlatformSelection = Record<PlatformId, boolean>;
export type PlatformAnchors = Record<PlatformId, string[]>;
export type PlatformCookieHeaders = Partial<Record<PlatformId, string>>;

export function createDefaultPlatformSelection(): PlatformSelection {
  return {
    douyu: true,
    huya: true,
    bilibili: true,
  };
}

export function createDefaultPlatformAnchors(): PlatformAnchors {
  return {
    douyu: [DEFAULT_DOUYU_ANCHOR],
    huya: [...DEFAULT_HUYA_ANCHORS],
    bilibili: [DEFAULT_BILIBILI_ANCHOR],
  };
}

export function getSelectedPlatformAnchors(selection: PlatformSelection, anchors: PlatformAnchors): string[] {
  return PLATFORM_ORDER.flatMap((platform) => selection[platform] ? anchors[platform] : []);
}

export function getSelectedPlatformNames(selection: PlatformSelection, language: "en" | "zh"): string {
  const names = PLATFORM_ORDER
    .filter((platform) => selection[platform])
    .map((platform) => PLATFORM_NAMES[platform][language]);

  if (names.length === 0) {
    return language === "zh" ? "未选择" : "none";
  }

  return language === "zh" ? names.join("、") : names.join(", ");
}

export function parseAnchorList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
