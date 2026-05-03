// ════════════════════════════════════════════════════════════════════════════
// NextAuth Session Type Augmentation
// ════════════════════════════════════════════════════════════════════════════
// Adds our custom fields (id, role) to the Session type.

import type { Role } from '@prisma/client';
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      passwordVersion: number;
    };
  }

  interface User {
    id: string;
    role: Role;
    passwordVersion: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
    passwordVersion: number;
  }
}
