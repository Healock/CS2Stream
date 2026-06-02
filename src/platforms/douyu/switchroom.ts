import * as cheerio from "cheerio";
import type { EventRoom } from "../../types.js";

export function parseDouyuSwitchRooms(html: string): EventRoom[] {
  const $ = cheerio.load(html);
  const rooms: EventRoom[] = [];
  const seenRoomIds = new Set<string>();

  $(".wm-pc-switchroom a[href*='douyu.com/']").each((_, element) => {
    const href = $(element).attr("href") ?? "";
    const roomId = extractDouyuRoomId(href);
    if (!roomId || seenRoomIds.has(roomId)) {
      return;
    }

    const label = $(element).find(".wm-pc-room-button-text").first().text().trim();
    if (!label) {
      return;
    }

    seenRoomIds.add(roomId);
    rooms.push({
      platform: "douyu",
      roomId,
      roomUrl: `https://www.douyu.com/${roomId}`,
      label,
    });
  });

  return rooms;
}

function extractDouyuRoomId(href: string): string | undefined {
  const match = href.match(/douyu\.com\/(\d+)(?:[/?#]|$)/);
  return match?.[1];
}
