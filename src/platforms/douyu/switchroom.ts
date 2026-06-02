import * as cheerio from "cheerio";
import type { EventRoom } from "../../types.js";

export function parseDouyuSwitchRooms(html: string): EventRoom[] {
  const $ = cheerio.load(html);
  const rooms: EventRoom[] = [];
  const seenRoomIds = new Set<string>();

  $(".wm-pc-switchroom a[href]").each((_, element) => {
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
  let url: URL;
  try {
    url = new URL(href, "https://www.douyu.com");
  } catch {
    return undefined;
  }

  if (url.hostname !== "www.douyu.com" && url.hostname !== "douyu.com") {
    return undefined;
  }

  const firstPathSegment = url.pathname.split("/").filter(Boolean)[0];
  return firstPathSegment && /^\d+$/.test(firstPathSegment) ? firstPathSegment : undefined;
}
