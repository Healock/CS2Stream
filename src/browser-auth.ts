import { resolveChromiumLaunchOptions, type BrowserLaunchOptions } from "./browser-launch.js";
import { DEFAULT_BILIBILI_ANCHOR, DEFAULT_DOUYU_ANCHOR, DEFAULT_HUYA_ANCHORS } from "./config.js";
import { PLATFORM_NAMES } from "./platform-config.js";
import type { PlatformId } from "./types.js";

interface BrowserAuthCookie {
  name: string;
  value: string;
}

interface BrowserAuthPage {
  goto(url: string, options: { waitUntil: "domcontentloaded" }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<unknown>;
}

interface BrowserAuthContext {
  newPage(): Promise<BrowserAuthPage>;
  cookies(urls: string[]): Promise<BrowserAuthCookie[]>;
  close?(): Promise<unknown>;
}

interface BrowserAuthBrowser {
  newContext(): Promise<BrowserAuthContext>;
  close(): Promise<unknown>;
}

interface BrowserAuthChromium {
  launch(options: BrowserLaunchOptions<false>): Promise<BrowserAuthBrowser>;
  launchPersistentContext(userDataDir: string, options: BrowserLaunchOptions<false>): Promise<BrowserAuthContext>;
}

export interface CaptureBrowserCookiesOptions {
  chromium?: BrowserAuthChromium;
  userDataDir?: string;
  browserExecutablePath?: string;
  waitMs?: number;
}

const PLATFORM_LOGIN_URLS: Record<PlatformId, string> = {
  douyu: DEFAULT_DOUYU_ANCHOR,
  huya: DEFAULT_HUYA_ANCHORS[0],
  bilibili: DEFAULT_BILIBILI_ANCHOR,
};

const PLATFORM_COOKIE_ORIGINS: Record<PlatformId, string> = {
  douyu: "https://www.douyu.com",
  huya: "https://www.huya.com",
  bilibili: "https://live.bilibili.com",
};

export function getPlatformLoginUrl(platform: PlatformId): string {
  return PLATFORM_LOGIN_URLS[platform];
}

export async function capturePlatformBrowserCookies(
  platform: PlatformId,
  options: CaptureBrowserCookiesOptions = {}
): Promise<string> {
  const chromium = options.chromium ?? await loadPlaywrightChromium();
  const launchOptions = resolveChromiumLaunchOptions(false, options);
  const waitMs = options.waitMs ?? 60_000;
  const loginUrl = getPlatformLoginUrl(platform);
  const cookieOrigin = PLATFORM_COOKIE_ORIGINS[platform];

  let browser: BrowserAuthBrowser | undefined;
  let context: BrowserAuthContext;
  if (options.userDataDir) {
    context = await chromium.launchPersistentContext(options.userDataDir, launchOptions);
  } else {
    browser = await chromium.launch(launchOptions);
    context = await browser.newContext();
  }

  try {
    const page = await context.newPage();
    await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(waitMs);
    const cookieHeader = formatCookieHeader(await context.cookies([cookieOrigin]));
    if (!cookieHeader) {
      throw new Error(`No usable ${PLATFORM_NAMES[platform].en} cookies were captured. Log in before the browser window closes, then try again.`);
    }
    return cookieHeader;
  } finally {
    if (browser) {
      await browser.close();
    } else {
      await context.close?.();
    }
  }
}

function formatCookieHeader(cookies: BrowserAuthCookie[]): string {
  return cookies
    .filter((cookie) => cookie.name && cookie.value)
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

async function loadPlaywrightChromium(): Promise<BrowserAuthChromium> {
  const { chromium } = await import("playwright");
  return chromium;
}
