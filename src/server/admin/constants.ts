/**
 * Shared by middleware (edge) and the admin session code, so no Node imports.
 *
 * On https the cookie is Secure and carries the __Host- prefix, which pins it
 * to this exact host: sibling subdomains can neither read nor overwrite it.
 * NextAuth names its own cookies by the same NEXTAUTH_URL test.
 */
export function usesSecureCookies(): boolean {
  return process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;
}

export function adminSessionCookieName(): string {
  return usesSecureCookies() ? "__Host-aergyle-admin" : "aergyle-admin";
}

export const ADMIN_LOGIN_PATH = "/admin/login";
/** Signs in and out; reachable without an admin session. */
export const ADMIN_SESSION_API_PATH = "/api/admin/session";
