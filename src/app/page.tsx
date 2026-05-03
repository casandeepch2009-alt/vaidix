import { redirect } from 'next/navigation'
import { auth } from '@/auth'

// Root entrypoint. Authenticated users go straight to the dashboard;
// unauthenticated users land on /login. We do this server-side so the
// browser never sees an intermediate URL with a `?callbackUrl=...` query
// string — that param is added by the auth middleware when it intercepts a
// protected route, and we keep `/` out of that protected set (see auth.config.ts).
export default async function Home() {
  const session = await auth()
  redirect(session?.user ? '/dashboard' : '/login')
}
