import type { PlatformId } from "./types.js";

const PLATFORM_TITLE_PREFIXES: Record<PlatformId, string> = {
  douyu: "1",
  huya: "2",
  bilibili: "3",
};

export function formatPlatformRoomLabel(platform: PlatformId, label: string): string {
  return `${PLATFORM_TITLE_PREFIXES[platform]}-${label}`;
}
