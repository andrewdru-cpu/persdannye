import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/lib/site-index";

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries();
}
