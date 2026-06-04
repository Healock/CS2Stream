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

const multiPlatformRooms: ResolvedRoom[] = [
  {
    platform: "douyu",
    roomId: "601514",
    roomUrl: "https://www.douyu.com/601514",
    label: "主舞台纯净流",
    ok: true,
    stream: { url: "https://stream.example/douyu.flv", format: "flv" },
  },
  {
    platform: "huya",
    roomId: "660000",
    roomUrl: "https://www.huya.com/660000",
    label: "主舞台纯净流",
    ok: true,
    stream: { url: "https://stream.example/huya.flv", format: "flv" },
  },
  {
    platform: "bilibili",
    roomId: "35",
    roomUrl: "https://live.bilibili.com/35",
    label: "主舞台纯净流",
    ok: true,
    stream: { url: "https://stream.example/bili.flv", format: "flv" },
  },
];

describe("playlist writers", () => {
  it("builds DPL with playname and one playable item", () => {
    expect(buildDpl("科隆MAJOR", rooms)).toContain("playname=科隆MAJOR");
    expect(buildDpl("科隆MAJOR", rooms)).toContain("1*file*https://stream.example/live.flv");
    expect(buildDpl("科隆MAJOR", rooms)).toContain("1*title*1-主舞台纯净流");
  });

  it("prefixes item titles when requested", () => {
    expect(buildDpl("科隆MAJOR", rooms, { prefixTitles: true })).toContain("1*title*[科隆MAJOR] 1-主舞台纯净流");
  });

  it("prefixes playlist titles with platform numbers", () => {
    const dpl = buildDpl("科隆MAJOR", multiPlatformRooms);

    expect(dpl).toContain("1*title*1-主舞台纯净流");
    expect(dpl).toContain("2*title*2-主舞台纯净流");
    expect(dpl).toContain("3*title*3-主舞台纯净流");
  });

  it("builds M3U fallback", () => {
    expect(buildM3u("科隆MAJOR", rooms)).toBe(
      "#EXTM3U\n#EXTINF:-1,1-主舞台纯净流\nhttps://stream.example/live.flv\n",
    );
  });

  it("prefixes M3U titles with platform numbers", () => {
    const m3u = buildM3u("科隆MAJOR", multiPlatformRooms);

    expect(m3u).toContain("#EXTINF:-1,1-主舞台纯净流");
    expect(m3u).toContain("#EXTINF:-1,2-主舞台纯净流");
    expect(m3u).toContain("#EXTINF:-1,3-主舞台纯净流");
  });

  it("normalizes playlist fields to prevent line injection", () => {
    const injectedRooms: ResolvedRoom[] = [
      {
        platform: "douyu",
        roomId: "601514",
        roomUrl: "https://www.douyu.com/601514",
        label: "Main\n#EXTM3U",
        ok: true,
        stream: {
          url: "https://stream.example/live.flv\r\n2*file*evil",
          format: "flv",
          quality: "best",
        },
      },
    ];

    const dpl = buildDpl("科隆\r\n2*file*evil", injectedRooms, { prefixTitles: true });
    const m3u = buildM3u("科隆\r\n2*file*evil", injectedRooms);

    expect(dpl).toContain("playname=科隆  2*file*evil");
    expect(dpl).toContain("1*file*https://stream.example/live.flv  2*file*evil");
    expect(dpl).toContain("1*title*[科隆  2*file*evil] 1-Main #EXTM3U");
    expect(dpl.split("\n")).not.toContain("2*file*evil");

    expect(m3u).toContain("#EXTINF:-1,1-Main #EXTM3U");
    expect(m3u).toContain("https://stream.example/live.flv  2*file*evil");
    expect(m3u.split("\n").filter((line) => line === "#EXTM3U")).toHaveLength(1);
    expect(m3u.split("\n")).not.toContain("2*file*evil");
  });
});
