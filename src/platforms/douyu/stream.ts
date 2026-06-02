import type { EventRoom, StreamCandidate } from "../../types.js";
import type { PlatformContext } from "../types.js";

export interface DouyuStreamPayload {
  rtmp_url?: string;
  rtmp_live?: string;
  url?: string;
  rate?: number;
  requiresAuth?: boolean;
}

export interface DouyuRoomStreamDeps {
  captureStreamPayload?: (room: EventRoom, context: PlatformContext) => Promise<DouyuStreamPayload | undefined>;
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
  room: EventRoom,
  context: PlatformContext,
  deps: DouyuRoomStreamDeps = {}
): Promise<StreamCandidate[]> {
  const captureStreamPayload = deps.captureStreamPayload ?? captureDouyuStreamPayload;
  const payload = await captureStreamPayload(room, context);
  return payload ? resolveDouyuStreamFromApiPayload(payload) : [];
}

async function captureDouyuStreamPayload(room: EventRoom, context: PlatformContext): Promise<DouyuStreamPayload | undefined> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch(resolveChromiumLaunchOptions());

  try {
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    });
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes(`/lapi/live/getH5PlayV1/${room.roomId}`),
      { timeout: context.timeoutMs }
    );

    await page.goto(room.roomUrl, { waitUntil: "domcontentloaded", timeout: context.timeoutMs });
    const response = await responsePromise;
    const body = (await response.json()) as { data?: DouyuStreamPayload };
    return body.data;
  } finally {
    await browser.close();
  }
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

function resolveChromiumLaunchOptions(): { headless: true; executablePath?: string } {
  const configuredPath = process.env.DOUYU_CS2_CHROME_PATH?.trim();
  if (configuredPath) {
    return { headless: true, executablePath: configuredPath };
  }

  if (process.platform === "win32") {
    return { headless: true, executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" };
  }

  return { headless: true };
}
