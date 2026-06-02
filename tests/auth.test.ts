import { describe, expect, it } from "vitest";
import { createAuthContext, redactCookieHeader, redactSecret } from "../src/auth.js";

describe("auth helpers", () => {
  it("creates an empty auth context by default", () => {
    expect(createAuthContext()).toEqual({ source: "none" });
  });

  it("redacts cookie values from loggable strings", () => {
    expect(redactSecret("acf_auth=abc123; dy_did=secret456")).toBe("acf_auth=<redacted>; dy_did=<redacted>");
  });

  it("exposes cookie-scoped redaction explicitly", () => {
    expect(redactCookieHeader("acf_auth=abc123; dy_did=secret456")).toBe(
      "acf_auth=<redacted>; dy_did=<redacted>"
    );
  });

  it("does not redact non-cookie bearer text", () => {
    expect(redactSecret("Bearer abc123")).toBe("Bearer abc123");
  });
});
