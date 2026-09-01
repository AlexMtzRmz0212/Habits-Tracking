import type { MetadataRoute } from "next";

/**
 * The dashboard is already unreachable without the PIN. Excluding it here is
 * about not advertising it: keeping the path out of search results means
 * nobody arrives at the lock screen from a search in the first place.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api/"],
    },
  };
}
