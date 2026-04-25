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
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isPublic =
        nextUrl.pathname === '/login' ||
        nextUrl.pathname.startsWith('/invitations/') ||
        nextUrl.pathname === '/forgot-password' ||
        nextUrl.pathname.startsWith('/reset-password/') ||
        nextUrl.pathname.startsWith('/api/auth/') ||
        nextUrl.pathname.startsWith('/api/invitations/verify/') ||
        nextUrl.pathname.startsWith('/api/invitations/accept/') ||
        nextUrl.pathname === '/api/classroom/webhooks/livekit' ||
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
