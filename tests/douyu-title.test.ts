import { describe, expect, it } from "vitest";
import { parseDouyuEventTitle } from "../src/platforms/douyu/title.js";

describe("parseDouyuEventTitle", () => {
  it("uses the text before the first underscore", () => {
    expect(
      parseDouyuEventTitle("科隆MAJOR_玩机器直播_玩机器丶Machine直播_玩机器CS2直播_玩机器斗鱼直播")
    ).toBe("科隆MAJOR");
  });

  it("trims whitespace around the event name", () => {
    expect(parseDouyuEventTitle(" 科隆MAJOR _斗鱼CSGO赛事主频道直播")).toBe("科隆MAJOR");
  });

  it("returns undefined when title is empty", () => {
    expect(parseDouyuEventTitle("")).toBeUndefined();
  });
});
