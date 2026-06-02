import type { AuthContext } from "../../types.js";

export async function fetchDouyuHtml(url: string, auth: AuthContext, timeoutMs: number): Promise<string> {
  const safeUrl = normalizeDouyuFetchUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(safeUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 PotPlayer-Douyu-CS2-Resolver/0.1",
        ...(auth.cookieHeader ? { Cookie: auth.cookieHeader } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Douyu page request failed with HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeDouyuFetchUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`Invalid Douyu fetch URL: ${input}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Invalid Douyu fetch protocol: ${url.protocol}`);
  }

  if (url.hostname !== "douyu.com" && url.hostname !== "www.douyu.com") {
    throw new Error(`Invalid Douyu fetch host: ${url.hostname}`);
  }

  const roomId = url.pathname.split("/").filter(Boolean)[0];
  if (!roomId || !/^\d+$/.test(roomId)) {
    throw new Error(`Invalid Douyu fetch room path: ${url.pathname}`);
  }

  return `https://www.douyu.com/${roomId}`;
}
