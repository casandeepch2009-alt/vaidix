// Read the `vaidix-csrf` cookie that NextAuth middleware refreshes on every
// request and return it as the `x-csrf-token` header (HARDENING-PLAN #15).
// Server-side `requireCsrf` constant-time compares cookie vs header.

export function csrfHeaders(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  const m = document.cookie.match(/(?:^|;\s*)vaidix-csrf=([^;]+)/);
  return m ? { 'x-csrf-token': decodeURIComponent(m[1]) } : {};
}
