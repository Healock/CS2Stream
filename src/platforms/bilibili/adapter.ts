import * as cheerio from "cheerio";
import type { EventRoom, StreamCandidate } from "../../types.js";
import type { PlatformAdapter, PlatformContext } from "../types.js";

export interface BilibiliAdapterDeps {
  fetchHtml?: (url: string, context: PlatformContext) => Promise<string>;
  fetchRoomPlayInfo?: (roomId: string, context: PlatformContext) => Promise<BilibiliRoomPlayInfoResponse>;
}

interface BilibiliRoomPlayInfoResponse {
  code?: number;
  message?: string;
  msg?: string;
  data?: {
    live_status?: number;
    playurl_info?: {
      playurl?: {
        stream?: BilibiliStream[];
      };
    };
  };
}

interface BilibiliStream {
  protocol_name?: string;
  format?: BilibiliFormat[];
}

interface BilibiliFormat {
  format_name?: string;
  codec?: BilibiliCodec[];
}

interface BilibiliCodec {
  current_qn?: number;
  base_url?: string;
  url_info?: BilibiliUrlInfo[];
}

interface BilibiliUrlInfo {
  host?: string;
  extra?: string;
}

export function createBilibiliAdapter(deps: BilibiliAdapterDeps = {}): PlatformAdapter {
  const fetchHtml = deps.fetchHtml ?? fetchBilibiliHtml;
  const fetchRoomPlayInfo = deps.fetchRoomPlayInfo ?? fetchBilibiliRoomPlayInfo;

  return {
    id: "bilibili",
    detect(input: string): boolean {
      try {
        normalizeBilibiliAnchor(input);
        return true;
      } catch {
        return false;
      }
    },
    async getEventTitle(anchor: string, context: PlatformContext): Promise<string | undefined> {
      const html = await fetchHtml(normalizeBilibiliAnchor(anchor), context);
      return parseBilibiliTitle(html);
    },
    async discoverEventRooms(anchor: string, context: PlatformContext): Promise<EventRoom[]> {
      const normalizedAnchor = normalizeBilibiliAnchor(anchor);
      const html = await fetchHtml(normalizedAnchor, context);
      const roomId = getBilibiliRoomId(normalizedAnchor);
      return [
        {
          platform: "bilibili",
          roomId,
          roomUrl: normalizedAnchor,
          label: parseBilibiliTitle(html) ?? `Bilibili ${roomId}`,
        },
      ];
    },
    async resolveStream(room: EventRoom, context: PlatformContext): Promise<StreamCandidate[]> {
      const response = await fetchRoomPlayInfo(room.roomId, context);
      if (response.code !== 0 || response.data?.live_status !== 1) {
        return [];
      }

      const candidates = await filterBilibiliCandidatesByBareMediaAccess(parseBilibiliStreamCandidates(response), context);
      return candidates.map((candidate) => ({ ...candidate, requiresAuth: true }));
    },
  };
}

export function normalizeBilibiliAnchor(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`Invalid Bilibili anchor URL: ${input}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Invalid Bilibili anchor protocol: ${url.protocol}`);
  }

  if (url.hostname !== "live.bilibili.com") {
    throw new Error(`Invalid Bilibili anchor host: ${url.hostname}`);
  }

  const roomId = getBilibiliRoomId(url.toString());
  if (!/^\d+$/.test(roomId)) {
    throw new Error(`Invalid Bilibili live room path: ${url.pathname}`);
  }

  return `https://live.bilibili.com/${roomId}`;
}

async function fetchBilibiliHtml(url: string, context: PlatformContext): Promise<string> {
  const safeUrl = normalizeBilibiliAnchor(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), context.timeoutMs);

  try {
    const response = await fetch(safeUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 CS2Stream/0.1",
        Referer: safeUrl,
        ...(context.auth.cookieHeader ? { Cookie: context.auth.cookieHeader } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Bilibili page request failed with HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBilibiliRoomPlayInfo(roomId: string, context: PlatformContext): Promise<BilibiliRoomPlayInfoResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), context.timeoutMs);
  const apiUrl = new URL("https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo");
  apiUrl.searchParams.set("room_id", roomId);
  apiUrl.searchParams.set("protocol", "0,1");
  apiUrl.searchParams.set("format", "0,1,2");
  apiUrl.searchParams.set("codec", "0,1");
  apiUrl.searchParams.set("qn", "10000");
  apiUrl.searchParams.set("platform", "web");
  apiUrl.searchParams.set("ptype", "8");

  try {
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 CS2Stream/0.1",
        Referer: `https://live.bilibili.com/${roomId}`,
        ...(context.auth.cookieHeader ? { Cookie: context.auth.cookieHeader } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Bilibili play info request failed with HTTP ${response.status}`);
    }

    return (await response.json()) as BilibiliRoomPlayInfoResponse;
  } finally {
    clearTimeout(timer);
  }
}

function parseBilibiliTitle(html: string): string | undefined {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  return title || undefined;
}

function parseBilibiliStreamCandidates(response: BilibiliRoomPlayInfoResponse): StreamCandidate[] {
  const candidates: StreamCandidate[] = [];

  for (const stream of response.data?.playurl_info?.playurl?.stream ?? []) {
    for (const format of stream.format ?? []) {
      for (const codec of format.codec ?? []) {
        for (const urlInfo of codec.url_info ?? []) {
          const url = buildBilibiliStreamUrl(urlInfo.host, codec.base_url, urlInfo.extra);
          if (!url) {
            continue;
          }

          candidates.push({
            url,
            format: getBilibiliStreamFormat(format.format_name, url),
            quality: codec.current_qn === undefined ? undefined : String(codec.current_qn),
          });
        }
      }
    }
  }

  return candidates;
}

function buildBilibiliStreamUrl(host?: string, baseUrl?: string, extra?: string): string | undefined {
  if (!host || !baseUrl) {
    return undefined;
  }

  return `${host.replace(/\/$/, "")}${baseUrl}${extra ?? ""}`;
}

function getBilibiliStreamFormat(formatName: string | undefined, url: string): StreamCandidate["format"] {
  if (formatName === "flv" || /\.flv(?:\?|$)/.test(url)) {
    return "flv";
  }

  if (formatName === "ts" || formatName === "fmp4" || /\.m3u8(?:\?|$)/.test(url)) {
    return "hls";
  }

  return "unknown";
}

function getBilibiliRoomId(url: string): string {
  return new URL(url).pathname.split("/").filter(Boolean)[0] ?? "";
}

async function filterBilibiliCandidatesByBareMediaAccess(
  candidates: StreamCandidate[],
  context: PlatformContext
): Promise<StreamCandidate[]> {
  if (candidates.length <= 1) {
    return candidates.length === 0 || await probeBareMediaUrl(candidates[0].url, context) ? candidates : [];
  }

  const probeResults = await Promise.all(candidates.map(async (candidate, index) => ({
    candidate,
    index,
    playable: await probeBareMediaUrl(candidate.url, context),
  })));

  return probeResults
    .filter((result) => result.playable)
    .sort((left, right) => left.index - right.index)
    .map((result) => result.candidate);
}

async function probeBareMediaUrl(url: string, context: PlatformContext): Promise<boolean> {
  return await probeBareMediaUrlOnce(url, context) && await probeBareMediaUrlOnce(url, context);
}

async function probeBareMediaUrlOnce(url: string, context: PlatformContext): Promise<boolean> {
  const controller = new AbortController();
  const timeoutMs = Math.min(Math.max(context.timeoutMs, 1), 3000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 CS2Stream/0.1",
        Range: "bytes=0-1023",
      },
    });
    await response.body?.cancel();
    return response.status >= 200 && response.status < 300;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
