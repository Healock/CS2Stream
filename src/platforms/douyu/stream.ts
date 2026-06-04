import { resolveChromiumLaunchOptions } from "../../browser-launch.js";
import type { EventRoom, StreamCandidate } from "../../types.js";
import type { PlatformContext } from "../types.js";

export interface DouyuStreamPayload {
  rtmp_url?: string;
  rtmp_live?: string;
  url?: string;
  rate?: number | string;
  multirates?: DouyuMultirate[];
  requiresAuth?: boolean;
}

export interface DouyuMultirate {
  name?: string;
  rate?: number | string;
  bit?: number | string;
  highBit?: number | string;
}

export interface DouyuRoomStreamDeps {
  captureStreamPayload?: (room: EventRoom, context: PlatformContext) => Promise<DouyuStreamPayload | undefined>;
}

interface DouyuBrowserCookie {
  name: string;
  value: string;
  url: string;
}

interface DouyuResponseLike {
  url(): string;
  json(): Promise<{ data?: DouyuStreamPayload }>;
  request(): {
    postData(): string | null;
  };
}

interface DouyuPageLike {
  goto(url: string, options: { waitUntil: "domcontentloaded"; timeout: number }): Promise<unknown>;
  waitForResponse(
    predicate: (response: DouyuResponseLike) => boolean,
    options: { timeout: number }
  ): Promise<DouyuResponseLike>;
  evaluate<T, Arg>(fn: (arg: Arg) => Promise<T>, arg: Arg): Promise<T>;
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

  const quality = getDouyuRateQuality(payload);
  if (quality) {
    candidate.quality = quality;
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

export interface PreferredDouyuRate {
  rate: number;
  quality?: string;
}

export function selectPreferredDouyuRate(payload: DouyuStreamPayload): PreferredDouyuRate | undefined {
  const currentRate = normalizeDouyuRate(payload.rate);
  const rates = normalizedDouyuMultirates(payload);
  const preferredRate =
    chooseBestDouyuRate(rates.filter((rate) => isDouyu60FpsRateName(rate.name))) ??
    rates.find((rate) => rate.rate === 0);

  if (!preferredRate || preferredRate.rate === currentRate) {
    return undefined;
  }

  return {
    rate: preferredRate.rate,
    quality: preferredRate.name,
  };
}

export async function preferDouyuStreamPayload(
  payload: DouyuStreamPayload,
  replayRate: (rate: number) => Promise<DouyuStreamPayload | undefined>
): Promise<DouyuStreamPayload> {
  const preferredRate = selectPreferredDouyuRate(payload);
  if (!preferredRate) {
    return payload;
  }

  let replayedPayload: DouyuStreamPayload | undefined;
  try {
    replayedPayload = await replayRate(preferredRate.rate);
  } catch {
    return payload;
  }

  if (!replayedPayload) {
    return payload;
  }

  const replayCandidate = {
    ...replayedPayload,
    multirates: replayedPayload.multirates ?? payload.multirates,
  };

  return resolveDouyuStreamFromApiPayload(replayCandidate).length > 0 ? replayCandidate : payload;
}

export function buildDouyuRateRequestBody(postData: string, rate: number): string {
  const encodedRate = encodeURIComponent(String(rate));
  if (/(^|&)rate=/.test(postData)) {
    return postData.replace(/(^|&)rate=[^&]*/, `$1rate=${encodedRate}`);
  }

  return `${postData}${postData.length > 0 ? "&" : ""}rate=${encodedRate}`;
}

export function buildDouyuBrowserCookies(cookieHeader: string | undefined): DouyuBrowserCookie[] {
  return (cookieHeader ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.includes("="))
    .map((item) => {
      const separatorIndex = item.indexOf("=");
      return {
        name: item.slice(0, separatorIndex).trim(),
        value: item.slice(separatorIndex + 1).trim(),
        url: "https://www.douyu.com",
      };
    })
    .filter((cookie) => cookie.name.length > 0);
}

async function captureDouyuStreamPayload(room: EventRoom, context: PlatformContext): Promise<DouyuStreamPayload | undefined> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch(resolveChromiumLaunchOptions(true));

  try {
    const browserContext = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    });

    const cookies = buildDouyuBrowserCookies(context.auth.cookieHeader);
    if (cookies.length > 0) {
      await browserContext.addCookies(cookies);
    }

    const page = await browserContext.newPage() as DouyuPageLike;
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes(`/lapi/live/getH5PlayV1/${room.roomId}`),
      { timeout: context.timeoutMs }
    );

    await page.goto(room.roomUrl, { waitUntil: "domcontentloaded", timeout: context.timeoutMs });
    const response = await responsePromise;
    const body = (await response.json()) as { data?: DouyuStreamPayload };
    if (!body.data) {
      return undefined;
    }

    const postData = response.request().postData();
    if (!postData) {
      return body.data;
    }

    return await preferDouyuStreamPayload(body.data, (rate) =>
      replayDouyuRatePayload(page, response.url(), postData, rate, context.timeoutMs)
    );
  } finally {
    await browser.close();
  }
}

async function replayDouyuRatePayload(
  page: DouyuPageLike,
  apiUrl: string,
  originalPostData: string,
  rate: number,
  timeoutMs: number
): Promise<DouyuStreamPayload | undefined> {
  const body = buildDouyuRateRequestBody(originalPostData, rate);
  return await page.evaluate(
    async ({ url, requestBody, requestTimeoutMs }) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          },
          body: requestBody,
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) {
          return undefined;
        }

        const json = await response.json() as { data?: DouyuStreamPayload };
        return json.data;
      } finally {
        clearTimeout(timer);
      }
    },
    { url: apiUrl, requestBody: body, requestTimeoutMs: timeoutMs }
  );
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

function getDouyuRateQuality(payload: DouyuStreamPayload): string | undefined {
  const currentRate = normalizeDouyuRate(payload.rate);
  const matchingRate = normalizedDouyuMultirates(payload).find((rate) => rate.rate === currentRate);
  return matchingRate?.name || (currentRate === 0 ? "best" : undefined);
}

interface NormalizedDouyuMultirate extends DouyuMultirate {
  rate: number;
  bit?: number;
  highBit?: number;
}

function normalizedDouyuMultirates(payload: DouyuStreamPayload): NormalizedDouyuMultirate[] {
  const rates: NormalizedDouyuMultirate[] = [];

  for (const rate of payload.multirates ?? []) {
    const normalizedRate = normalizeDouyuRate(rate.rate);
    if (normalizedRate === undefined) {
      continue;
    }

    rates.push({
      ...rate,
      rate: normalizedRate,
      bit: normalizeDouyuRate(rate.bit),
      highBit: normalizeDouyuRate(rate.highBit),
    });
  }

  return rates;
}

function chooseBestDouyuRate(rates: NormalizedDouyuMultirate[]): NormalizedDouyuMultirate | undefined {
  return rates
    .slice()
    .sort((left, right) =>
      (right.highBit ?? 0) - (left.highBit ?? 0) ||
      (right.bit ?? 0) - (left.bit ?? 0) ||
      left.rate - right.rate
    )[0];
}

function isDouyu60FpsRateName(name: string | undefined): boolean {
  return /(?:^|[^0-9])60(?:\u5e27|fps|p|$)/i.test(name ?? "");
}

function normalizeDouyuRate(value: number | string | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.floor(parsed) : undefined;
  }

  return undefined;
}
