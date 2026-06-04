import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { EventRoom, StreamCandidate } from "../../types.js";
import type { PlatformAdapter, PlatformContext } from "../types.js";

export interface HuyaAdapterDeps {
  fetchHtml?: (url: string, context: PlatformContext) => Promise<string>;
  probeMedia?: (url: string, context: PlatformContext) => Promise<boolean>;
}

interface HuyaStreamRoot {
  data?: HuyaStreamData[];
}

interface HuyaStreamData {
  gameLiveInfo?: {
    profileRoom?: number | string;
    roomName?: string;
    introduction?: string;
    gameFullName?: string;
    screenType?: number;
    liveSourceType?: number;
  };
  gameStreamInfoList?: HuyaStreamInfo[];
}

interface HuyaStreamInfo {
  lPresenterUid?: number | string;
  sStreamName?: string;
  sFlvUrl?: string;
  sFlvUrlSuffix?: string;
  sFlvAntiCode?: string;
  sHlsUrl?: string;
  sHlsUrlSuffix?: string;
  sHlsAntiCode?: string;
}

export function createHuyaAdapter(deps: HuyaAdapterDeps = {}): PlatformAdapter {
  const fetchHtml = deps.fetchHtml ?? fetchHuyaHtml;
  const probeMedia = deps.probeMedia ?? probeBareHuyaMediaUrl;

  return {
    id: "huya",
    detect(input: string): boolean {
      try {
        normalizeHuyaAnchor(input);
        return true;
      } catch {
        return false;
      }
    },
    async getEventTitle(anchor: string, context: PlatformContext): Promise<string | undefined> {
      const html = await fetchHtml(normalizeHuyaAnchor(anchor), context);
      return parseHuyaLiveMetadataTitle(html) ?? parseHuyaEventTitle(html);
    },
    async discoverEventRooms(anchor: string, context: PlatformContext): Promise<EventRoom[]> {
      const normalizedAnchor = normalizeHuyaAnchor(anchor);
      const html = await fetchHtml(normalizedAnchor, context);
      const streamData = parseHuyaStreamData(html);
      if (streamData && !hasHuyaLiveStreamInfo(streamData)) {
        return [];
      }

      const roomId = getHuyaRoomIdFromStreamData(streamData) ?? getHuyaRoomIdFromUrl(normalizedAnchor);
      const label = getHuyaRoomLabelFromStreamData(streamData) ?? parseHuyaEventTitle(html) ?? `Huya ${roomId}`;

      return [
        {
          platform: "huya",
          roomId,
          roomUrl: normalizedAnchor,
          label,
        },
      ];
    },
    async resolveStream(room: EventRoom, context: PlatformContext): Promise<StreamCandidate[]> {
      const html = await fetchHtml(normalizeHuyaAnchor(room.roomUrl), context);
      return filterCandidatesByBareAccess(parseHuyaStreamCandidates(html), context, probeMedia);
    },
  };
}

export function normalizeHuyaAnchor(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`Invalid Huya anchor URL: ${input}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Invalid Huya anchor protocol: ${url.protocol}`);
  }

  if (url.hostname !== "huya.com" && url.hostname !== "www.huya.com") {
    throw new Error(`Invalid Huya anchor host: ${url.hostname}`);
  }

  const roomPath = url.pathname.split("/").filter(Boolean)[0];
  if (!roomPath || !/^[A-Za-z0-9_-]+$/.test(roomPath)) {
    throw new Error(`Invalid Huya anchor room path: ${url.pathname}`);
  }

  return `https://www.huya.com/${roomPath}`;
}

async function fetchHuyaHtml(url: string, context: PlatformContext): Promise<string> {
  const safeUrl = normalizeHuyaAnchor(url);
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
      throw new Error(`Huya page request failed with HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseHuyaEventTitle(html: string): string | undefined {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  const firstPart = title.split("_", 1)[0]?.trim();
  const cleaned = firstPart?.replace(/直播_视频直播 - 虎牙直播$/, "").trim();
  return cleaned || undefined;
}

function parseHuyaLiveMetadataTitle(html: string): string | undefined {
  const liveInfo = parseHuyaStreamData(html)?.data?.[0]?.gameLiveInfo;
  const title = liveInfo?.roomName?.trim() || liveInfo?.introduction?.trim();
  return title || undefined;
}

function parseHuyaStreamCandidates(html: string): StreamCandidate[] {
  const streamData = parseHuyaStreamData(html);
  const data = streamData?.data?.[0];
  const streamInfoList = data?.gameStreamInfoList?.filter((item) => item.sStreamName) ?? [];

  if (streamInfoList.length === 0) {
    return [];
  }

  const candidates: StreamCandidate[] = [];
  for (const streamInfo of streamInfoList) {
    for (const antiCode of buildHuyaAntiCodeVariants(streamInfo.sFlvAntiCode, streamInfo.sStreamName, streamInfo.lPresenterUid)) {
      const flvUrl = buildHuyaStreamUrl(streamInfo.sFlvUrl, streamInfo.sStreamName, streamInfo.sFlvUrlSuffix, antiCode);
      if (flvUrl) {
        candidates.push({ url: flvUrl, format: "flv" });
      }
    }

    for (const antiCode of buildHuyaAntiCodeVariants(streamInfo.sHlsAntiCode, streamInfo.sStreamName, streamInfo.lPresenterUid)) {
      const hlsUrl = buildHuyaStreamUrl(streamInfo.sHlsUrl, streamInfo.sStreamName, streamInfo.sHlsUrlSuffix, antiCode);
      if (hlsUrl) {
        candidates.push({ url: hlsUrl, format: "hls" });
      }
    }
  }

  return dedupeCandidates(candidates);
}

function parseHuyaStreamData(html: string): HuyaStreamRoot | undefined {
  const raw = extractBalancedObjectAfterMarker(html, "stream:");
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as HuyaStreamRoot;
  } catch {
    return undefined;
  }
}

function getHuyaRoomIdFromStreamData(streamData: HuyaStreamRoot | undefined): string | undefined {
  const roomId = streamData?.data?.[0]?.gameLiveInfo?.profileRoom;
  return roomId === undefined || roomId === null ? undefined : String(roomId);
}

function getHuyaRoomLabelFromStreamData(streamData: HuyaStreamRoot | undefined): string | undefined {
  return streamData?.data?.[0]?.gameLiveInfo?.roomName?.trim() || undefined;
}

function getHuyaRoomIdFromUrl(url: string): string {
  return new URL(url).pathname.split("/").filter(Boolean)[0] ?? url;
}

function hasHuyaLiveStreamInfo(streamData: HuyaStreamRoot): boolean {
  return (streamData.data ?? []).some((data) => data.gameStreamInfoList?.some((streamInfo) => streamInfo.sStreamName));
}

function buildHuyaStreamUrl(baseUrl?: string, streamName?: string, suffix?: string, antiCode?: string): string | undefined {
  if (!baseUrl || !streamName || !suffix || !antiCode) {
    return undefined;
  }

  return `${baseUrl.replace(/\/$/, "")}/${streamName}.${suffix.replace(/^\./, "")}?${antiCode}`;
}

function buildHuyaAntiCodeVariants(
  antiCode: string | undefined,
  streamName: string | undefined,
  presenterUid: number | string | undefined
): string[] {
  const variants = [
    signHuyaAntiCode(antiCode, streamName, presenterUid, "presenter"),
    signHuyaAntiCode(antiCode, streamName, presenterUid, "yt-dlp"),
    antiCode,
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(variants));
}

function signHuyaAntiCode(
  antiCode: string | undefined,
  streamName: string | undefined,
  presenterUid: number | string | undefined,
  mode: "presenter" | "yt-dlp"
): string | undefined {
  if (!antiCode || !streamName || presenterUid === undefined || presenterUid === null) {
    return antiCode;
  }

  const params = new URLSearchParams(antiCode);
  const fm = params.get("fm");
  const wsTime = params.get("wsTime");
  const ctype = params.get("ctype");
  if (!fm || !wsTime || !ctype) {
    return antiCode;
  }

  const signingTime = Number.parseInt(wsTime, 16) + Math.random();
  const presenterUidNumber = Number(presenterUid);
  const uid = mode === "yt-dlp" && streamName.startsWith(String(presenterUid))
    ? String(Math.floor((signingTime % 1e7) * 1e6 % 0xffffffff))
    : String(presenterUid);
  const seqid = mode === "yt-dlp" ? String(Math.floor(signingTime * 1000) + Number(uid)) : `${uid}${Date.now()}`;
  const uuid = mode === "yt-dlp" ? String(Math.floor((signingTime % 1e7) * 1e6 % 0xffffffff)) : String(Math.floor(Math.random() * 2_147_483_647));
  const signedUid = mode === "yt-dlp" ? transformHuyaUid(uid) : uid;
  let decodedFm: string;
  try {
    decodedFm = Buffer.from(fm, "base64").toString("utf8");
  } catch {
    return antiCode;
  }
  const wsSecretPrefix = decodedFm.split("_", 1)[0];
  const wsSecret = md5(`${wsSecretPrefix}_${signedUid}_${streamName}_${md5(`${seqid}|${ctype}|${params.get("t") ?? "100"}`)}_${wsTime}`);

  params.set("wsSecret", wsSecret);
  params.set("u", signedUid);
  params.set("seqid", seqid);
  params.set("uuid", uuid);
  params.set("ver", "1");
  params.set("t", "100");

  return params.toString();
}

function md5(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

function transformHuyaUid(uid: string): string {
  const value = BigInt(uid);
  const upper = value & 0xffffffff00000000n;
  const lower = value & 0xffffffffn;
  const low24 = value & 0xffffffn;
  return (upper | (lower >> 24n) | (low24 << 8n)).toString();
}

function dedupeCandidates(candidates: StreamCandidate[]): StreamCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.url)) {
      return false;
    }

    seen.add(candidate.url);
    return true;
  });
}

async function filterCandidatesByBareAccess(
  candidates: StreamCandidate[],
  context: PlatformContext,
  probeMedia: (url: string, context: PlatformContext) => Promise<boolean>
): Promise<StreamCandidate[]> {
  if (candidates.length === 0) {
    return [];
  }

  const probeResults = await Promise.all(candidates.map(async (candidate, index) => ({
    candidate,
    index,
    playable: await probeMedia(candidate.url, context),
  })));

  return probeResults
    .filter((result) => result.playable)
    .sort((left, right) => left.index - right.index)
    .map((result) => result.candidate);
}

async function probeBareHuyaMediaUrl(url: string, context: PlatformContext): Promise<boolean> {
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

function extractBalancedObjectAfterMarker(text: string, marker: string): string | undefined {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) {
    return undefined;
  }

  const openIndex = text.indexOf("{", markerIndex);
  if (openIndex < 0) {
    return undefined;
  }

  let depth = 0;
  let quote: "\"" | "'" | undefined;
  let escaped = false;
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(openIndex, index + 1);
      }
    }
  }

  return undefined;
}
