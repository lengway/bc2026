import type { MetadataRoute } from "next";
import { publicSitemap } from "./_lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicSitemap();
}
