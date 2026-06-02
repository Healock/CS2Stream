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
  const directUrl = payload.url ?? joinDouyuStreamUrl(payload.rtmp_url, payload.rtmp_live);
  if (!directUrl) return [];

  return [
    {
      url: directUrl,
      format: inferFormat(directUrl),
      quality: payload.rate === 0 ? "best" : undefined,
      requiresAuth: payload.requiresAuth || undefined,
    },
  ];
}

export async function resolveDouyuRoomStream(
  _room: EventRoom,
  _context: PlatformContext
): Promise<StreamCandidate[]> {
  return [];
}

function joinDouyuStreamUrl(base?: string, live?: string): string | undefined {
  if (!base || !live) return undefined;
  return `${base.replace(/\/$/, "")}/${live.replace(/^\//, "")}`;
}

function inferFormat(url: string): "flv" | "hls" | "unknown" {
  if (url.includes(".flv")) return "flv";
  if (url.includes(".m3u8")) return "hls";
  return "unknown";
}
