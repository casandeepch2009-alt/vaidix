// ════════════════════════════════════════════════════════════════════════════
// NextAuth — Edge-compatible config (no Node-only imports)
// ════════════════════════════════════════════════════════════════════════════
// Separated so middleware (edge runtime) can use the config without pulling in
// bcrypt / Prisma (which are Node-only). The full config (auth.ts) extends this
// with the credentials provider.

import type { NextAuthConfig } from 'next-auth';
import type { Role } from '@prisma/client';

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 8, // 8 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as { role: Role }).role;
        token.passwordVersion = (user as unknown as { passwordVersion: number }).passwordVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        // Required by requireAuth() for the per-request passwordVersion
        // re-check (HARDENING-PLAN item #13).
        session.user.passwordVersion = (token.passwordVersion as number) ?? 0;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isPublic =
        // Root is public — `src/app/page.tsx` resolves the right destination
        // server-side (dashboard vs. login). Treating it as public keeps the
        // middleware from prepending `?callbackUrl=http://...` to the URL.
        nextUrl.pathname === '/' ||
        nextUrl.pathname === '/login' ||
        nextUrl.pathname.startsWith('/invitations/') ||
        nextUrl.pathname === '/forgot-password' ||
        nextUrl.pathname.startsWith('/reset-password/') ||
        nextUrl.pathname.startsWith('/api/auth/') ||
        nextUrl.pathname.startsWith('/api/invitations/verify/') ||
        nextUrl.pathname.startsWith('/api/invitations/accept/') ||
        nextUrl.pathname === '/api/classroom/webhooks/livekit' ||
        // Probes for orchestrator / load balancer. Public by design.
        nextUrl.pathname === '/api/health' ||
        nextUrl.pathname === '/api/ready' ||
        // CSRF token bootstrap — needed before sign-in (HARDENING-PLAN #15).
        nextUrl.pathname === '/api/csrf' ||
        // Recording share links are public by design — anyone with a valid
        // (sha256-hashed at rest, HARDENING-PLAN #12) token can view. The
        // route handler enforces token + optional password + expiry/revoke.
        /^\/api\/recordings\/share\/[^/]+$/.test(nextUrl.pathname) ||
        /^\/recordings\/share\/[^/]+$/.test(nextUrl.pathname) ||
        // Live-captions ingest is bearer-token authed inside the route handler
        // (LiveKit Agent uses a shared secret, not session cookies).
        /^\/api\/classroom\/sessions\/[^/]+\/live-captions\/ingest$/.test(nextUrl.pathname);
      if (isPublic) return true;
      if (!isLoggedIn) return false;
      return true;
    },
  },
  providers: [], // populated in auth.ts
};
