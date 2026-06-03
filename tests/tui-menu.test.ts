import { describe, expect, test } from "vitest";
import {
  createInitialTuiState,
  parseMenuAction,
  renderMainMenu,
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
