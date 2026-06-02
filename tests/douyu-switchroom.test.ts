import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDouyuSwitchRooms } from "../src/platforms/douyu/switchroom.js";

describe("parseDouyuSwitchRooms", () => {
  it("parses Douyu switch-room links from the event page container", () => {
    const html = readFileSync(join(process.cwd(), "samples", "wm-pc-switchroom.html"), "utf8");

    expect(parseDouyuSwitchRooms(html)).toEqual([
      {
        platform: "douyu",
        roomId: "6979222",
        roomUrl: "https://www.douyu.com/6979222",
        label: "玩机器",
      },
      {
        platform: "douyu",
        roomId: "178432",
        roomUrl: "https://www.douyu.com/178432",
        label: "QUQU",
      },
      {
        platform: "douyu",
        roomId: "63136",
        roomUrl: "https://www.douyu.com/63136",
        label: "冬瓜",
      },
      {
        platform: "douyu",
        roomId: "601514",
        roomUrl: "https://www.douyu.com/601514",
        label: "主舞台纯净流",
      },
      {
        platform: "douyu",
        roomId: "9392697",
        roomUrl: "https://www.douyu.com/9392697",
        label: "副舞台纯净流",
      },
    ]);
  });

  it("returns an empty list when the switch-room container is missing", () => {
    expect(parseDouyuSwitchRooms("<main></main>")).toEqual([]);
  });
});
