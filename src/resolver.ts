import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createAuthContext } from "./auth.js";
import { DEFAULT_HUYA_ANCHORS, createDefaultConfig, type ResolverConfig } from "./config.js";
import { buildDpl } from "./playlist/dpl.js";
import { createBilibiliAdapter } from "./platforms/bilibili/adapter.js";
import { createDouyuAdapter } from "./platforms/douyu/adapter.js";
import { createHuyaAdapter } from "./platforms/huya/adapter.js";
import { AmbiguousPlatformError, findPlatformAdapter } from "./platforms/registry.js";
import type { PlatformAdapter, PlatformContext } from "./platforms/types.js";
import type { EventRoom, PlatformId, ResolvedRoom, ResolverError, ResolverResult } from "./types.js";

export interface RunResolverOptions extends Partial<ResolverConfig> {
  adapters?: PlatformAdapter[];
  cookieHeader?: string;
  platformCookieHeaders?: Partial<Record<PlatformId, string>>;
}

export async function runResolver(options: RunResolverOptions = {}): Promise<ResolverResult> {
  const config = createDefaultConfig(options);
  const adapters = options.adapters ?? createDefaultPlatformAdapters();
  const defaultAuth = createAuthContext(options.cookieHeader);

  let eventTitle: string | undefined;
  const resolvedRooms: ResolvedRoom[] = [];
  const errors: ResolverError[] = [];
  const emptyAnchorErrors: ResolverError[] = [];

  for (const anchor of config.anchors) {
    const adapterResult = selectAdapter(anchor, adapters);

    if (!adapterResult.adapter) {
      errors.push(adapterResult.error);
      continue;
    }

    const adapter = adapterResult.adapter;
    const context = createPlatformContext(adapter.id, config.timeoutMs, defaultAuth.cookieHeader, options.platformCookieHeaders);
    let anchorTitle: string | undefined;
    try {
      anchorTitle = await adapter.getEventTitle(anchor, context);
      eventTitle ??= anchorTitle;
    } catch (error) {
      errors.push({ code: "anchor_unreachable", message: errorMessage(error) });
      continue;
    }

    if (!anchorTitle) {
      errors.push({ code: "title_missing", message: "Could not derive event title from anchor page" });
      continue;
    }

    let rooms: EventRoom[];
    try {
      rooms = await adapter.discoverEventRooms(anchor, context);
    } catch (error) {
      errors.push({ code: "anchor_unreachable", message: errorMessage(error) });
      continue;
    }

    if (rooms.length === 0) {
      emptyAnchorErrors.push({ code: "switchroom_missing", message: "No rooms found in wm-pc-switchroom" });
      continue;
    }

    rooms = filterRoomsByCleanStreamPolicy(rooms, config.cleanStreamFilter);

    if (rooms.length === 0) {
      emptyAnchorErrors.push({ code: "clean_stream_missing", message: "No rooms found with titles containing 纯净流" });
      continue;
    }

    resolvedRooms.push(
      ...(await mapWithConcurrency(
        rooms,
        normalizedConcurrency(config.streamConcurrency),
        async (room): Promise<ResolvedRoom> => resolveRoom(adapter, room, context)
      ))
    );
  }

  errors.push(...collectRoomErrors(resolvedRooms));
  const playableCount = resolvedRooms.filter((room) => room.ok).length;

  if (playableCount === 0) {
    return {
      ok: false,
      eventTitle,
      rooms: resolvedRooms,
      errors: [...errors, ...emptyAnchorErrors],
    };
  }

  const playlistTitle = eventTitle ?? "CS2 Streams";
  let playlistPath: string;
  try {
    mkdirSync(config.outputDir, { recursive: true });
    playlistPath = join(config.outputDir, `${sanitizeFileName(playlistTitle)}.dpl`);
    writeFileSync(playlistPath, buildDpl(playlistTitle, resolvedRooms, { prefixTitles: config.prefixTitles }), "utf8");
  } catch (error) {
    return {
      ok: false,
      eventTitle,
      rooms: resolvedRooms,
      errors: [{ code: "playlist_write_failed", message: errorMessage(error) }],
    };
  }

  return {
    ok: true,
    eventTitle: playlistTitle,
    playlistPath,
    rooms: resolvedRooms,
    errors,
  };
}

function createPlatformContext(
  platform: PlatformId,
  timeoutMs: number,
  defaultCookieHeader?: string,
  platformCookieHeaders: Partial<Record<PlatformId, string>> = {}
): PlatformContext {
  return {
    auth: createAuthContext(platformCookieHeaders[platform] ?? defaultCookieHeader),
    timeoutMs,
  };
}

function createDefaultPlatformAdapters(): PlatformAdapter[] {
  return [createDouyuAdapter(), createHuyaAdapter(), createBilibiliAdapter()];
}

function selectAdapter(anchor: string, adapters: PlatformAdapter[]): { adapter: PlatformAdapter; error?: never } | { adapter?: never; error: ResolverError } {
  try {
    const adapter = findPlatformAdapter(anchor, adapters);

    if (!adapter) {
      return {
        error: { code: "unsupported_platform", message: `No platform adapter supports ${anchor}` },
      };
    }

    return { adapter };
  } catch (error) {
    if (error instanceof AmbiguousPlatformError) {
      return {
        error: { code: "unsupported_platform", message: error.message },
      };
    }

    throw error;
  }
}

async function resolveRoom(adapter: PlatformAdapter, room: EventRoom, context: PlatformContext): Promise<ResolvedRoom> {
  try {
    const candidates = await adapter.resolveStream(room, context);
    const stream = candidates.find((candidate) => !candidate.requiresAuth);

    if (!stream && candidates.some((candidate) => candidate.requiresAuth)) {
      return {
        ...room,
        ok: false,
        error: { code: "auth_required", message: `${room.label} requires account authentication` },
      };
    }

    if (!stream) {
      return {
        ...room,
        ok: false,
        error: { code: "stream_resolution_failed", message: `${room.label} did not produce a playable stream` },
      };
    }

    return { ...room, ok: true, stream };
  } catch (error) {
    return {
      ...room,
      ok: false,
      error: { code: "stream_resolution_failed", message: errorMessage(error) },
    };
  }
}

function collectRoomErrors(rooms: ResolvedRoom[]): ResolverError[] {
  return rooms.map((room) => room.error).filter((error): error is ResolverError => Boolean(error));
}

function filterRoomsByCleanStreamPolicy<T extends { label: string; platform?: PlatformId; roomUrl?: string }>(rooms: T[], policy: "clean-only" | "all"): T[] {
  if (policy === "all") {
    return rooms;
  }

  return rooms.filter((room) => room.label.includes("纯净流") || isOfficialHuyaCs2EventRoom(room));
}

function isOfficialHuyaCs2EventRoom(room: { platform?: PlatformId; roomUrl?: string }): boolean {
  if (room.platform !== "huya" || !room.roomUrl) {
    return false;
  }

  try {
    const roomUrl = new URL(room.roomUrl);
    return DEFAULT_HUYA_ANCHORS.some((anchor) => {
      const anchorUrl = new URL(anchor);
      return roomUrl.hostname === anchorUrl.hostname && roomUrl.pathname === anchorUrl.pathname;
    });
  } catch {
    return false;
  }
}

async function mapWithConcurrency<T, U>(items: T[], limit: number, mapper: (item: T) => Promise<U>): Promise<U[]> {
  const results = new Array<U>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(normalizedConcurrency(limit), items.length);

  if (workerCount === 0) {
    return [];
  }

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function normalizedConcurrency(value: number): number {
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 3;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_");
}
