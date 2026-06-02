import { describe, expect, it } from "vitest";
import { createDefaultConfig } from "../src/config.js";

describe("CLI defaults", () => {
  it("uses room 601514 as the default anchor", () => {
    expect(createDefaultConfig().anchor).toBe("https://www.douyu.com/601514");
  });
});
