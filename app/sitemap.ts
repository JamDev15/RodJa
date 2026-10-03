import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";

// Built per request (cached by the CDN) so new public listings show up
// without a redeploy and the build never depends on database access.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/listings`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  try {
    const listings = await prisma.property.findMany({
      where: { isListed: true },
      select: { id: true, slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    });
    for (const l of listings) {
      pages.push({ url: `${SITE_URL}/listings/${l.slug ?? l.id}`, lastModified: l.updatedAt, changeFrequency: "weekly", priority: 0.6 });
    }
  } catch (err) {
    console.error("sitemap: listings unavailable", err);
  }
  return pages;
}
