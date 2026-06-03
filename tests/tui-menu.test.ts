import { describe, expect, test } from "vitest";
import type { ResolverResult } from "../src/types.js";
import {
  createInitialTuiState,
  parseMenuAction,
  renderPlaceholderMessage,
  renderMainMenu,
  renderResultSummary,
} from "../src/tui/menu.js";

describe("TUI menu", () => {
  test("renders default Douyu CS2 state", () => {
    const menu = renderMainMenu(createInitialTuiState());

    expect(menu).toContain("CS2 Stream Assistant");
    expect(menu).toContain("Anchor: https://www.douyu.com/601514");
    expect(menu).toContain("Output: out");
    expect(menu).toContain("PotPlayer: auto");
    expect(menu).toContain("1. Resolve Douyu CS2 and open in PotPlayer");
    expect(menu).toContain("8. Other platform settings");
    expect(menu).toContain("0. Exit");
  });

  test.each([
    ["1", "resolve-and-open"],
    ["2", "resolve-only"],
    ["3", "show-last-result"],
    ["4", "set-potplayer-path"],
    ["5", "set-anchor"],
    ["6", "set-output-dir"],
    ["7", "auth-settings"],
    ["8", "platform-settings"],
    ["0", "exit"],
  ] as const)("maps input %s to %s", (input, action) => {
    expect(parseMenuAction(input)).toBe(action);
  });

  test("trims input before parsing", () => {
    expect(parseMenuAction(" 1 ")).toBe("resolve-and-open");
  });

  test("returns invalid for unknown menu choices", () => {
    expect(parseMenuAction("9")).toBe("invalid");
    expect(parseMenuAction("abc")).toBe("invalid");
  });
});

describe("TUI result summaries", () => {
  test("summarizes successful resolver result", () => {
    const result: ResolverResult = {
      ok: true,
      eventTitle: "科隆MAJOR",
      playlistPath: "out\\科隆MAJOR.dpl",
      rooms: [
        {
          platform: "douyu",
          roomId: "1",
          roomUrl: "https://www.douyu.com/1",
          label: "主舞台",
          ok: true,
          stream: { url: "https://example.test/live.flv", format: "flv" },
        },
        {
          platform: "douyu",
          roomId: "2",
          roomUrl: "https://www.douyu.com/2",
          label: "副舞台",
          ok: false,
          error: { code: "stream_resolution_failed", message: "offline" },
        },
      ],
      errors: [{ code: "stream_resolution_failed", message: "offline" }],
    };

    const summary = renderResultSummary(result);

    expect(summary).toContain("Event: 科隆MAJOR");
    expect(summary).toContain("Playlist: out\\科隆MAJOR.dpl");
    expect(summary).toContain("Rooms: 2 total, 1 playable, 1 failed");
    expect(summary).toContain("- 副舞台: offline");
  });

  test("summarizes failed resolver result without rooms", () => {
    const result: ResolverResult = {
      ok: false,
      rooms: [],
      errors: [{ code: "anchor_unreachable", message: "network failed" }],
    };

    const summary = renderResultSummary(result);

    expect(summary).toContain("Resolve failed");
    expect(summary).toContain("- anchor_unreachable: network failed");
  });

  test("renders explicit placeholder messages", () => {
    expect(renderPlaceholderMessage("auth-settings")).toContain("Account authentication settings are reserved");
    expect(renderPlaceholderMessage("platform-settings")).toContain("Huya and Bilibili support is reserved");
  });
});
