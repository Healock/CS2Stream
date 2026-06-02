import { describe, expect, it } from "vitest";
import type { ResolvedRoom } from "../src/types.js";
import { buildDpl } from "../src/playlist/dpl.js";
import { buildM3u } from "../src/playlist/m3u.js";

const rooms: ResolvedRoom[] = [
  {
    platform: "douyu",
    roomId: "601514",
    roomUrl: "https://www.douyu.com/601514",
    label: "主舞台纯净流",
    ok: true,
    stream: { url: "https://stream.example/live.flv", format: "flv", quality: "best" },
  },
];

describe("playlist writers", () => {
  it("builds DPL with playname and one playable item", () => {
    expect(buildDpl("科隆MAJOR", rooms)).toContain("playname=科隆MAJOR");
    expect(buildDpl("科隆MAJOR", rooms)).toContain("1*file*https://stream.example/live.flv");
    expect(buildDpl("科隆MAJOR", rooms)).toContain("1*title*主舞台纯净流");
  });

  it("prefixes item titles when requested", () => {
    expect(buildDpl("科隆MAJOR", rooms, { prefixTitles: true })).toContain("1*title*[科隆MAJOR] 主舞台纯净流");
  });

  it("builds M3U fallback", () => {
    expect(buildM3u("科隆MAJOR", rooms)).toBe(
      "#EXTM3U\n#EXTINF:-1,主舞台纯净流\nhttps://stream.example/live.flv\n",
    );
  });
});
