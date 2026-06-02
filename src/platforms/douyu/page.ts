import type { AuthContext } from "../../types.js";

export async function fetchDouyuHtml(url: string, auth: AuthContext, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
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
