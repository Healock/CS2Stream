import type { ResolvedRoom } from "../types.js";

export interface DplOptions {
  prefixTitles?: boolean;
}

export function buildDpl(eventTitle: string, rooms: ResolvedRoom[], options: DplOptions = {}): string {
  const playableRooms = rooms.filter((room) => room.ok && room.stream?.url);
  const lines = ["DAUMPLAYLIST", `playname=${eventTitle}`, "topindex=0", "saveplaypos=0"];

  playableRooms.forEach((room, index) => {
    const item = index + 1;
    const title = options.prefixTitles ? `[${eventTitle}] ${room.label}` : room.label;
    lines.push(`${item}*file*${room.stream?.url ?? ""}`);
    lines.push(`${item}*title*${title}`);
  });

  return `${lines.join("\n")}\n`;
}
