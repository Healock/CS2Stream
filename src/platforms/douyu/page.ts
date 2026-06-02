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

export async function renderDouyuHtml(url: string, timeoutMs: number): Promise<string> {
  const safeUrl = normalizeDouyuFetchUrl(url);
  const { chromium } = await import("playwright");
  const launchOptions = resolveChromiumLaunchOptions();
  const browser = await chromium.launch(launchOptions);

  try {
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    });
    await page.goto(safeUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForSelector(".wm-pc-switchroom", { timeout: timeoutMs });
    return await page.content();
  } finally {
    await browser.close();
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
