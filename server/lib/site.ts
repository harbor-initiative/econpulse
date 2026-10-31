/**
 * One origin, one name.
 *
 * The canonical host is a constant rather than a request header, because a
 * canonical tag that follows `Host` is a canonical tag that agrees with whatever
 * a proxy sends. The old host redirects here (#26) and the redirect is the only
 * thing that knows about it.
 */

export const SITE = {
  origin: "https://econpulse.harborgovcon.com",
  name: "EconPulse",
  description: "Every number about a place, with its receipt.",
} as const;

/** An absolute URL for a path, for canonicals and sitemaps. */
export function absolute(pathname: string): string {
  return `${SITE.origin}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}
