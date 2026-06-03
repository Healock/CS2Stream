import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createAuthContext } from "./auth.js";
import { createDefaultConfig, type ResolverConfig } from "./config.js";
import { buildDpl } from "./playlist/dpl.js";
import { createDouyuAdapter } from "./platforms/douyu/adapter.js";
import { AmbiguousPlatformError, findPlatformAdapter } from "./platforms/registry.js";
import type { PlatformAdapter } from "./platforms/types.js";
import type { ResolvedRoom, ResolverError, ResolverResult } from "./types.js";

export interface RunResolverOptions extends Partial<ResolverConfig> {
  adapters?: PlatformAdapter[];
  cookieHeader?: string;
}

export async function runResolver(options: RunResolverOptions = {}): Promise<ResolverResult> {
  const config = createDefaultConfig(options);
  const adapters = options.adapters ?? [createDouyuAdapter()];
  const adapterResult = selectAdapter(config.anchor, adapters);

  if (!adapterResult.adapter) {
    return {
      ok: false,
      rooms: [],
      errors: [adapterResult.error],
    };
  }

  const adapter = adapterResult.adapter;
  const context = {
    auth: createAuthContext(options.cookieHeader),
    timeoutMs: config.timeoutMs,
  };

  let eventTitle: string | undefined;
  try {
    eventTitle = await adapter.getEventTitle(config.anchor, context);
  } catch (error) {
    return {
      ok: false,
      rooms: [],
      errors: [{ code: "anchor_unreachable", message: errorMessage(error) }],
    };
  }

  if (!eventTitle) {
    return {
      ok: false,
      rooms: [],
      errors: [{ code: "title_missing", message: "Could not derive event title from anchor page" }],
    };
  }

  let rooms;
  try {
    rooms = await adapter.discoverEventRooms(config.anchor, context);
  } catch (error) {
    return {
      ok: false,
      eventTitle,
      rooms: [],
      errors: [{ code: "anchor_unreachable", message: errorMessage(error) }],
    };
  }

  if (rooms.length === 0) {
    return {
      ok: false,
      eventTitle,
      rooms: [],
      errors: [{ code: "switchroom_missing", message: "No rooms found in wm-pc-switchroom" }],
    };
  }

  rooms = filterRoomsByCleanStreamPolicy(rooms, config.cleanStreamFilter);

  if (rooms.length === 0) {
    return {
      ok: false,
      eventTitle,
      rooms: [],
      errors: [{ code: "clean_stream_missing", message: "No rooms found with titles containing 纯净流" }],
    };
  }

  const resolvedRooms = await mapWithConcurrency(
    rooms,
    normalizedConcurrency(config.streamConcurrency),
    async (room): Promise<ResolvedRoom> => {
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
  );

  const errors = collectRoomErrors(resolvedRooms);
  const playableCount = resolvedRooms.filter((room) => room.ok).length;

  if (playableCount === 0) {
    return {
      ok: false,
      eventTitle,
      rooms: resolvedRooms,
      errors,
    };
  }

  let playlistPath: string;
  try {
    mkdirSync(config.outputDir, { recursive: true });
    playlistPath = join(config.outputDir, `${sanitizeFileName(eventTitle)}.dpl`);
    writeFileSync(playlistPath, buildDpl(eventTitle, resolvedRooms, { prefixTitles: config.prefixTitles }), "utf8");
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
    eventTitle,
    playlistPath,
    rooms: resolvedRooms,
    errors,
  };
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

function collectRoomErrors(rooms: ResolvedRoom[]): ResolverError[] {
  return rooms.map((room) => room.error).filter((error): error is ResolverError => Boolean(error));
}

function filterRoomsByCleanStreamPolicy<T extends { label: string }>(rooms: T[], policy: "clean-only" | "all"): T[] {
  if (policy === "all") {
    return rooms;
  }

  return rooms.filter((room) => room.label.includes("纯净流"));
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
