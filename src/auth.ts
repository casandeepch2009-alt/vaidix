// ════════════════════════════════════════════════════════════════════════════
// NextAuth v5 — Main config (Node runtime)
// ════════════════════════════════════════════════════════════════════════════

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { loginSchema } from './lib/validation/auth';
import { verifyCredentials } from './server/services/auth-service';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const result = await verifyCredentials(parsed.data.email, parsed.data.password);
        if (!result.ok) return null;

        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          passwordVersion: result.user.passwordVersion,
        };
      },
    }),
  ],
});
