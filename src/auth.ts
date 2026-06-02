import type { AuthContext } from "./types.js";

export function createAuthContext(cookieHeader?: string): AuthContext {
  if (!cookieHeader?.trim()) {
    return { source: "none" };
  }

  return {
    source: "cookie-file",
    cookieHeader: cookieHeader.trim()
  };
}

export function redactSecret(value: string): string {
  return redactCookieHeader(value);
}

export function redactCookieHeader(value: string): string {
  return value.replace(/([^=;\s]+)=([^;]+)/g, "$1=<redacted>");
}
