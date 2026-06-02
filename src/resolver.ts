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

  const eventTitle = await adapter.getEventTitle(config.anchor, context);
  if (!eventTitle) {
    return {
      ok: false,
      rooms: [],
      errors: [{ code: "title_missing", message: "Could not derive event title from anchor page" }],
    };
  }

  const rooms = await adapter.discoverEventRooms(config.anchor, context);
  if (rooms.length === 0) {
    return {
      ok: false,
      eventTitle,
      rooms: [],
      errors: [{ code: "switchroom_missing", message: "No rooms found in wm-pc-switchroom" }],
    };
  }

  const resolvedRooms: ResolvedRoom[] = await Promise.all(
    rooms.map(async (room) => {
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
    })
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

  mkdirSync(config.outputDir, { recursive: true });
  const playlistPath = join(config.outputDir, `${sanitizeFileName(eventTitle)}.dpl`);
  writeFileSync(playlistPath, buildDpl(eventTitle, resolvedRooms, { prefixTitles: config.prefixTitles }), "utf8");

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

function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_");
}
