import * as cheerio from "cheerio";
import type { EventRoom, StreamCandidate } from "../../types.js";
import type { PlatformAdapter, PlatformContext } from "../types.js";
import { fetchDouyuHtml } from "./page.js";
import { parseDouyuSwitchRooms } from "./switchroom.js";
import { parseDouyuEventTitle } from "./title.js";

export interface DouyuAdapterDeps {
  fetchHtml?: (url: string, context: PlatformContext) => Promise<string>;
  resolveStream?: (room: EventRoom, context: PlatformContext) => Promise<StreamCandidate[]>;
}

export function createDouyuAdapter(deps: DouyuAdapterDeps = {}): PlatformAdapter {
  const fetchHtml = deps.fetchHtml ?? ((url, context) => fetchDouyuHtml(url, context.auth, context.timeoutMs));
  const resolveStream = deps.resolveStream ?? (async () => []);

  return {
    id: "douyu",
    detect(input: string): boolean {
      try {
        normalizeDouyuAnchor(input);
        return true;
      } catch {
        return false;
      }
    },
    async getEventTitle(anchor: string, context: PlatformContext): Promise<string | undefined> {
      const html = await fetchHtml(normalizeDouyuAnchor(anchor), context);
      const $ = cheerio.load(html);
      return parseDouyuEventTitle($("title").first().text());
    },
    async discoverEventRooms(anchor: string, context: PlatformContext): Promise<EventRoom[]> {
      const html = await fetchHtml(normalizeDouyuAnchor(anchor), context);
      return parseDouyuSwitchRooms(html);
    },
    resolveStream,
  };
}

export function normalizeDouyuAnchor(input: string): string {
  if (/^\d+$/.test(input)) {
    return `https://www.douyu.com/${input}`;
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`Invalid Douyu anchor URL: ${input}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Invalid Douyu anchor protocol: ${url.protocol}`);
  }

  if (url.hostname !== "douyu.com" && url.hostname !== "www.douyu.com") {
    throw new Error(`Invalid Douyu anchor host: ${url.hostname}`);
  }

  const roomId = url.pathname.split("/").filter(Boolean)[0];
  if (!roomId || !/^\d+$/.test(roomId)) {
    throw new Error(`Invalid Douyu anchor room path: ${url.pathname}`);
  }

  url.protocol = "https:";
  url.hostname = "www.douyu.com";
  url.pathname = `/${roomId}`;
  return url.toString();
}
