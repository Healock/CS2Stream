import type { ResolvedRoom } from "../types.js";
import { formatPlatformRoomLabel } from "../platform-labels.js";

export interface DplOptions {
  prefixTitles?: boolean;
}

export function buildDpl(eventTitle: string, rooms: ResolvedRoom[], options: DplOptions = {}): string {
  const normalizedEventTitle = normalizePlaylistField(eventTitle);
  const playableRooms = rooms.filter((room) => room.ok && room.stream?.url);
  const lines = ["DAUMPLAYLIST", `playname=${normalizedEventTitle}`, "topindex=0", "saveplaypos=0"];

  playableRooms.forEach((room, index) => {
    const item = index + 1;
    const label = normalizePlaylistField(formatPlatformRoomLabel(room.platform, room.label));
    const title = options.prefixTitles ? `[${normalizedEventTitle}] ${label}` : label;
    lines.push(`${item}*file*${normalizePlaylistField(room.stream?.url ?? "")}`);
    lines.push(`${item}*title*${title}`);
  });

  return `${lines.join("\n")}\n`;
}

function normalizePlaylistField(value: string): string {
  return value.replace(/[\x00-\x1F\x7F]/g, " ").trim();
}
