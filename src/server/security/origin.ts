/**
 * Cross-site request forgery guard for state-changing requests. Runs in
 * middleware (edge) and in route handlers, so it only touches headers.
 *
 * SameSite cookies alone aren't enough here: sibling subdomains of the same
 * site (other apps on markomalec.com) count as "same site" and would get the
 * cookies sent along.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase());
}

function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * True when a request came from one of our own pages. Browsers send
 * Sec-Fetch-Site on every request (older ones at least send Origin); a request
 * with neither didn't come from a browser, so it can't carry a victim's
 * cookies either.
 */
export function isSameOriginRequest(headers: Headers): boolean {
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";

  const origin = headers.get("origin");
  if (!origin) return true;
  const originHost = hostOf(origin);
  if (!originHost) return false;

  const allowed = new Set(
    [
      hostOf(process.env.NEXTAUTH_URL),
      headers.get("x-forwarded-host")?.split(",")[0]?.trim().toLowerCase(),
      headers.get("host")?.toLowerCase(),
    ].filter((host): host is string => Boolean(host)),
  );
  return allowed.has(originHost);
}
