import * as cheerio from "cheerio";
import type { EventRoom, StreamCandidate } from "../../types.js";
import type { PlatformAdapter, PlatformContext } from "../types.js";
import { fetchDouyuHtml, normalizeDouyuFetchUrl } from "./page.js";
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

  try {
    return normalizeDouyuFetchUrl(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message.replace("Douyu fetch", "Douyu anchor"));
  }
}
