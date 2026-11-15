import type { Metadata, MetadataRoute } from "next";
import { mocksEnabled } from "./environment";

export const publicOrigin = "https://gambit.lengway.me";
export const noIndex = "noindex, nofollow";

const publicPages = {
  "/": {
    title: "Practice Realistic Work Conversations",
    description:
      "Practice realistic work conversations with an AI copilot, get a move-by-move review, and share a certificate from qualifying simulations.",
  },
  "/pricing": {
    title: "Pricing",
    description:
      "Compare Gambit Free and Pro for realistic work simulations, move-by-move reviews, and shareable skill certificates.",
  },
  "/terms": {
    title: "Terms of Use",
    description:
      "Read Gambit’s terms for practice simulations, AI-assisted feedback, sharing result links, and managing your account.",
  },
  "/challenge": {
    title: "Spot the Mismatch Challenge",
    description:
      "Try a three-minute Gambit challenge and check Copilot’s advice against fictional work documents.",
  },
} satisfies Record<string, { title: string; description: string }>;

export function publicMetadata(
  path: keyof typeof publicPages,
  preview = mocksEnabled,
): Metadata {
  const { title, description } = publicPages[path];
  const canonical = new URL(path, publicOrigin).href;

  return {
    title,
    description,
    alternates: { canonical },
    robots: preview ? noIndex : "index, follow",
    openGraph: {
      type: "website",
      siteName: "Gambit",
      title: `${title} · Gambit`,
      description,
      url: canonical,
    },
  };
}

export function publicSitemap(preview = mocksEnabled): MetadataRoute.Sitemap {
  if (preview) return [];
  return Object.keys(publicPages).map((path) => ({
    url: new URL(path, publicOrigin).href,
  }));
}

export function robotsPolicy(preview = mocksEnabled): MetadataRoute.Robots {
  if (preview) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${publicOrigin}/sitemap.xml`,
  };
}
