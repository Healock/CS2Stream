import type { AuthContext, EventRoom, PlatformId, StreamCandidate } from "../types.js";

export interface PlatformContext {
  auth: AuthContext;
  timeoutMs: number;
}

export interface PlatformAdapter {
  id: PlatformId;
  detect(input: string): boolean;
  discoverEventRooms(anchor: string, context: PlatformContext): Promise<EventRoom[]>;
  getEventTitle(anchor: string, context: PlatformContext): Promise<string | undefined>;
  resolveStream(room: EventRoom, context: PlatformContext): Promise<StreamCandidate[]>;
}
