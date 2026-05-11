# Extracting the live-classroom module

This folder hosts the LiveKit-backed video room (UI + hooks). It's been
written so it can be lifted into another product without rebuilding from
scratch — the components do not call `fetch('/api/classroom/...')` directly;
they call methods on a `VideoRoomClient` interface defined in
[`video-room-client.tsx`](./video-room-client.tsx).

## What's inside

| File | Purpose | Coupling |
|---|---|---|
| `video-room-client.tsx` | The adapter interface + default LMS implementation + React context | **Replace this in your project** |
| `live-session.tsx` | Top-level orchestrator (PreJoin → Waiting → Joined). Token request, fullscreen takeover, control bar. | Pure |
| `pre-join.tsx` | Mic/camera setup screen before joining | Pure |
| `waiting-room.tsx` | "Waiting for host to admit you…" | Pure |
| `participant-sidebar.tsx`, `participant-strip.tsx` | People list / Teams-style avatar strip | Pure (calls client) |
| `chat-panel.tsx` | Chat tab with attachments + @mention picker | Pure (calls client) |
| `whiteboard-panel.tsx` | tldraw canvas — broadcast + persistence | **Partially refactored** — load/save still call LMS endpoint directly (see TODO) |
| `noise-suppression-toggle.tsx` | Headless: always-on Krisp / browser noise filter | Pure |
| `bg-picker.tsx` | Virtual background + blur picker. Uses `/public/bg/*.jpg` assets. | Pure |
| `pip-button.tsx`, `popout-button.tsx` | Picture-in-picture / pop-out window | Pure |
| `reactions-bar.tsx` | Floating emoji reactions with per-actor column hashing | Pure (calls client via `useSessionEvents`) |
| `hand-raise-notifications.tsx` | Floating "X raised their hand" toast | Pure |
| `breakouts-panel.tsx`, `breakout-room-view.tsx` | Breakout rooms | Calls LMS endpoints directly (not yet refactored) |
| `host-controls-menu.tsx` (in `live-session.tsx`) | Mute-all / share-link / end | Pure (calls client) |

Plus dependency files outside this folder:

- [`src/hooks/use-session-events.ts`](../../hooks/use-session-events.ts) — replayable event bus over LiveKit data channel + persistence (calls client)
- [`src/components/engagement/*`](../engagement) — `HookOverlay`, `LiveCaptionsOverlay`, `LeaderboardPanel`, `CoachPanel`, `HooksComposer`, `PresenterAlertsHud` (presenter-alerts uses client; the rest hit LMS endpoints directly — TODO)
- [`src/lib/livekit.ts`](../../lib/livekit.ts) — server-side `mintLiveKitToken` (used inside the LMS API route handler, not by the components themselves)

## Quickstart for the new product

1. **Copy** these directories into your project:
   - `src/components/classroom/`
   - `src/components/engagement/` (drop the parts you don't need)
   - `src/hooks/use-session-events.ts`
   - `public/bg/` (the wallpaper JPEGs)

2. **Provide a `VideoRoomClient`** by implementing the interface in
   `video-room-client.tsx`. The default `defaultLmsVideoRoomClient` is the
   reference impl — copy its method signatures, swap the URLs.

3. **Wrap your tree** with the provider:

   ```tsx
   import { VideoRoomClientProvider } from './components/classroom/video-room-client'
   import { LiveSession } from './components/classroom/live-session'

   <VideoRoomClientProvider client={myProductClient}>
     <LiveSession session={…} currentUser={…} />
   </VideoRoomClientProvider>
   ```

4. **Mint LiveKit tokens server-side** using your own auth. The component
   never sees credentials — it just calls `client.getToken(sessionId)` and
   trusts whatever JWT comes back. Use the LiveKit Server SDK:

   ```ts
   import { AccessToken } from 'livekit-server-sdk'

   const at = new AccessToken(API_KEY, API_SECRET, {
     identity: user.id,
     name: user.name?.trim() || user.id,  // never empty — see livekit.ts comment
   })
   at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true })
   ```

5. **Required peer dependencies**:
   - `react` ≥ 19
   - `@livekit/components-react`, `livekit-client`
   - `@livekit/track-processors` (virtual backgrounds + blur)
   - `@livekit/krisp-noise-filter` (optional — graceful fallback to browser noise suppression)
   - `framer-motion`, `lucide-react`
   - A shadcn-style `Button`/`Input` (or substitute your design system's primitives)
   - `next` ≥ 16 if you're using Next.js routing (`useRouter` is used by `LiveSession` for navigation back to calendar — easy to swap)

## What still needs decoupling

The pieces below still talk directly to `/api/classroom/sessions/...`:

- `whiteboard-panel.tsx` — load/save snapshot. Needs the
  `WhiteboardSnapshot` interface to grow an optional `meta` field for
  product-specific moderation flags (e.g. `editableByResidents`).
- `breakouts-panel.tsx` and `breakout-room-view.tsx` — full breakout flow.
- Most `src/components/engagement/*` panels (leaderboard, hooks composer,
  coach, captions). The `PresenterAlertsHud` is done.
- File-attachment download URLs assume a presigned-URL flow — the
  `reserveFile`/`finalizeFile` interface methods mirror that. Different
  storage backends (e.g. direct multipart) need a different shape.

Any of these can be ported to the client interface in the same pattern
(introduce a new method, route the fetch through it, leave the LMS impl
unchanged).

## Why this design (vs a full package extraction)

This is a **decoupling pass**, not a workspace split. Reasons:

- Components stay in their original location, so tooling (ESLint, Tailwind
  config, TypeScript paths, hot-reload) keeps working in the LMS today.
- Refactor was incremental and non-breaking — the default client uses the
  exact same endpoints the components used to hit directly.
- A future `@vaidix/video-room` workspace package can be carved out by
  moving these files into `packages/video-room/src/` and adding a
  `package.json`. The interfaces are already in the right shape.

If you want the workspace split now, the work is ~1 day:
1. Create `packages/video-room/` workspace.
2. Move `src/components/classroom/*` + `src/hooks/use-session-events.ts`.
3. Replace `@/components/ui/*` and `@/lib/utils` imports with the
   relocated paths (or factor those primitives out too).
4. Publish or workspace-link from the consumer app.
