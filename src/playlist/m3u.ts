import type { ResolvedRoom } from "../types.js";
import { formatPlatformRoomLabel } from "../platform-labels.js";

export function buildM3u(_eventTitle: string, rooms: ResolvedRoom[]): string {
  const lines = ["#EXTM3U"];

  for (const room of rooms) {
    if (!room.ok || !room.stream?.url) continue;
    lines.push(`#EXTINF:-1,${normalizePlaylistField(formatPlatformRoomLabel(room.platform, room.label))}`);
    lines.push(normalizePlaylistField(room.stream.url));
  }

  return `${lines.join("\n")}\n`;
}

function normalizePlaylistField(value: string): string {
  return value.replace(/[\x00-\x1F\x7F]/g, " ").trim();
}
