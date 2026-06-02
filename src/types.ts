export type PlatformId = "douyu" | "huya" | "bilibili";

export interface AuthContext {
  cookieHeader?: string;
  source?: "none" | "cookie-file" | "browser-profile";
}

export interface EventRoom {
  platform: PlatformId;
  roomId: string;
  roomUrl: string;
  label: string;
}

export interface StreamCandidate {
  url: string;
  format: "flv" | "hls" | "unknown";
  quality?: string;
  requiresAuth?: boolean;
}

export interface ResolvedRoom extends EventRoom {
  ok: boolean;
  stream?: StreamCandidate;
  error?: ResolverError;
}

export interface ResolverError {
  code:
    | "network_error"
    | "anchor_unreachable"
    | "title_missing"
    | "switchroom_missing"
    | "auth_required"
    | "room_offline"
    | "stream_resolution_failed"
    | "unsupported_platform"
    | "playlist_write_failed";
  message: string;
}

export interface ResolverResult {
  ok: boolean;
  eventTitle?: string;
  playlistPath?: string;
  rooms: ResolvedRoom[];
  errors: ResolverError[];
}
