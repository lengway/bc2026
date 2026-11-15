import type { MetadataRoute } from "next";
import { robotsPolicy } from "./_lib/seo";

export default function robots(): MetadataRoute.Robots {
  return robotsPolicy();
}
