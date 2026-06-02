import type { EventRoom, StreamCandidate } from "../../types.js";
import type { PlatformContext } from "../types.js";

export interface DouyuStreamPayload {
  rtmp_url?: string;
  rtmp_live?: string;
  url?: string;
  rate?: number;
  requiresAuth?: boolean;
}

export function resolveDouyuStreamFromApiPayload(payload: DouyuStreamPayload): StreamCandidate[] {
  const directUrl = payload.url?.trim();
  const candidateUrl = directUrl || joinDouyuStreamUrl(payload.rtmp_url, payload.rtmp_live);
  if (!candidateUrl) return [];

  const parsedUrl = parseSupportedStreamUrl(candidateUrl);
  if (!parsedUrl) return [];

  const candidate: StreamCandidate = {
    url: candidateUrl,
    format: inferFormat(parsedUrl),
  };

  if (payload.rate === 0) {
    candidate.quality = "best";
  }

  if (payload.requiresAuth) {
    candidate.requiresAuth = true;
  }

  return [candidate];
}

export async function resolveDouyuRoomStream(
  _room: EventRoom,
  _context: PlatformContext
): Promise<StreamCandidate[]> {
  return [];
}

function joinDouyuStreamUrl(base?: string, live?: string): string | undefined {
  const trimmedBase = base?.trim();
  const trimmedLive = live?.trim();
  if (!trimmedBase || !trimmedLive) return undefined;
  return `${trimmedBase.replace(/\/$/, "")}/${trimmedLive.replace(/^\//, "")}`;
}

function parseSupportedStreamUrl(url: string): URL | undefined {
  try {
    const parsedUrl = new URL(url);
    if (!["http:", "https:", "rtmp:"].includes(parsedUrl.protocol)) return undefined;
    return parsedUrl;
  } catch {
    return undefined;
  }
}

function inferFormat(url: URL): "flv" | "hls" | "unknown" {
  const pathname = url.pathname.toLowerCase();
  if (pathname.endsWith(".flv")) return "flv";
  if (pathname.endsWith(".m3u8")) return "hls";
  return "unknown";
}
