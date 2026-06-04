import { existsSync } from "node:fs";

export interface BrowserLaunchOptions<Headless extends boolean> {
  headless: Headless;
  executablePath?: string;
}

export interface ResolveBrowserExecutablePathOptions {
  env?: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
  exists?: (path: string) => boolean;
}

export function resolveChromiumLaunchOptions<Headless extends boolean>(
  headless: Headless,
  options: ResolveBrowserExecutablePathOptions & { browserExecutablePath?: string } = {}
): BrowserLaunchOptions<Headless> {
  const browserExecutablePath = options.browserExecutablePath?.trim() || resolveBrowserExecutablePath(options);
  return browserExecutablePath
    ? { headless, executablePath: browserExecutablePath }
    : { headless };
}

export function resolveBrowserExecutablePath(options: ResolveBrowserExecutablePathOptions = {}): string | undefined {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const exists = options.exists ?? existsSync;
  const configuredPath = env.CS2STREAM_BROWSER_PATH?.trim() || env.DOUYU_CS2_CHROME_PATH?.trim();
  if (configuredPath) {
    return configuredPath;
  }

  if (platform !== "win32") {
    return undefined;
  }

  return windowsBrowserCandidates(env).find((candidate) => exists(candidate));
}

function windowsBrowserCandidates(env: Record<string, string | undefined>): string[] {
  const candidates = [
    env.ProgramFiles ? `${env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe` : undefined,
    env["ProgramFiles(x86)"] ? `${env["ProgramFiles(x86)"]}\\Google\\Chrome\\Application\\chrome.exe` : undefined,
    env.LOCALAPPDATA ? `${env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : undefined,
    env.ProgramFiles ? `${env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe` : undefined,
    env["ProgramFiles(x86)"] ? `${env["ProgramFiles(x86)"]}\\Microsoft\\Edge\\Application\\msedge.exe` : undefined,
    env.LOCALAPPDATA ? `${env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe` : undefined,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ];

  return [...new Set(candidates.filter((candidate): candidate is string => Boolean(candidate)))];
}
