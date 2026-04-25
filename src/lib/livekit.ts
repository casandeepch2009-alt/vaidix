// ════════════════════════════════════════════════════════════════════════════
// LiveKit Server SDK wrapper
// ════════════════════════════════════════════════════════════════════════════
// Mints access tokens for participants, manages rooms, starts/stops Egress.

import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
  WebhookReceiver,
  type ParticipantPermission,
} from 'livekit-server-sdk';
import { env } from './env';

export const roomClient = new RoomServiceClient(
  env.LIVEKIT_URL.replace(/^ws/, 'http'),
  env.LIVEKIT_API_KEY,
  env.LIVEKIT_API_SECRET
);

export const webhookReceiver = new WebhookReceiver(
  env.LIVEKIT_API_KEY,
  env.LIVEKIT_API_SECRET
);

export type LiveKitRole = 'host' | 'co_host' | 'participant' | 'viewer';

export interface TokenOptions {
  identity: string; // user id
  name: string; // display name
  roomName: string;
  role: LiveKitRole;
  ttlSeconds?: number;
  metadata?: Record<string, unknown>;
  // Residents get Mic/Camera but NOT screen share unless host grants it
  canShareScreen?: boolean;
}

export async function mintLiveKitToken(opts: TokenOptions): Promise<string> {
  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: opts.identity,
    name: opts.name,
    ttl: opts.ttlSeconds ?? 3600,
    metadata: opts.metadata ? JSON.stringify(opts.metadata) : undefined,
  });

  const isViewer = opts.role === 'viewer';
  const isAdminish = opts.role === 'host' || opts.role === 'co_host';

  const canPublishSources: TrackSource[] = isViewer
    ? []
    : [TrackSource.MICROPHONE, TrackSource.CAMERA];
  if (!isViewer && (isAdminish || opts.canShareScreen)) {
    canPublishSources.push(TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO);
  }

  at.addGrant({
    roomJoin: true,
    room: opts.roomName,
    canPublish: !isViewer,
    canSubscribe: true,
    canPublishData: !isViewer,
    canPublishSources,
    roomAdmin: isAdminish,
    canUpdateOwnMetadata: true,
  });

  return at.toJwt();
}

// ----------------------------------------------------------------------------
// Room lifecycle
// ----------------------------------------------------------------------------
export async function createRoom(name: string, maxParticipants = 100) {
  return roomClient.createRoom({
    name,
    maxParticipants,
    emptyTimeout: 300,
    departureTimeout: 20,
  });
}

export async function listRooms() {
  return roomClient.listRooms();
}

export async function deleteRoom(name: string) {
  return roomClient.deleteRoom(name);
}

export async function endRoom(name: string) {
  // LiveKit doesn't have a distinct "end" — deleteRoom disconnects everyone.
  return roomClient.deleteRoom(name);
}

// ----------------------------------------------------------------------------
// Participant ops
// ----------------------------------------------------------------------------
export async function listParticipants(roomName: string) {
  return roomClient.listParticipants(roomName);
}

export async function removeParticipant(roomName: string, identity: string) {
  return roomClient.removeParticipant(roomName, identity);
}

export async function muteTrack(
  roomName: string,
  identity: string,
  trackSid: string,
  muted = true
) {
  return roomClient.mutePublishedTrack(roomName, identity, trackSid, muted);
}

export async function updateParticipantMetadata(
  roomName: string,
  identity: string,
  metadata: Record<string, unknown>
) {
  return roomClient.updateParticipant(roomName, identity, JSON.stringify(metadata));
}

export async function updateParticipantPermissions(
  roomName: string,
  identity: string,
  permission: ParticipantPermission
) {
  return roomClient.updateParticipant(roomName, identity, undefined, permission);
}

export async function sendDataMessage(
  roomName: string,
  data: Uint8Array,
  destinationIdentities?: string[]
) {
  return roomClient.sendData(roomName, data, 1 /* reliable */, {
    destinationIdentities,
  });
}

export function sessionRoomName(sessionId: string): string {
  return `session-${sessionId}`;
}
