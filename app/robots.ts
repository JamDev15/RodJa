import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Private app areas stay out of search; public marketing pages and listings
// are open to search engines and AI answer engines alike.
const PRIVATE = ["/dashboard", "/admin", "/tenant", "/api/", "/sign/", "/docs/", "/renew", "/magic-login", "/offline"];
const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended", "Bingbot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: ["/", "/llms.txt"], disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
