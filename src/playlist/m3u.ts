import type { ResolvedRoom } from "../types.js";

export function buildM3u(_eventTitle: string, rooms: ResolvedRoom[]): string {
  const lines = ["#EXTM3U"];

  for (const room of rooms) {
    if (!room.ok || !room.stream?.url) continue;
    lines.push(`#EXTINF:-1,${room.label}`);
    lines.push(room.stream.url);
  }

  return `${lines.join("\n")}\n`;
}
