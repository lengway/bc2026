import { describe, expect, it } from "vitest";
import { publicMetadata, publicSitemap, robotsPolicy } from "./seo";

describe("public search metadata", () => {
  it("gives each public page its own canonical and search snippet", () => {
    const pages = ["/", "/pricing", "/terms", "/challenge"] as const;
    const metadata = pages.map((path) => publicMetadata(path, false));

    expect(metadata.map((page) => page.alternates?.canonical)).toEqual([
      "https://gambit.lengway.me/",
      "https://gambit.lengway.me/pricing",
      "https://gambit.lengway.me/terms",
      "https://gambit.lengway.me/challenge",
    ]);
    expect(new Set(metadata.map((page) => page.title)).size).toBe(pages.length);
    expect(new Set(metadata.map((page) => page.description)).size).toBe(
      pages.length,
    );
    expect(metadata.every((page) => page.robots === "index, follow")).toBe(
      true,
    );
  });

  it("publishes exactly the canonical public pages without invented dates", () => {
    expect(publicSitemap(false)).toEqual([
      { url: "https://gambit.lengway.me/" },
      { url: "https://gambit.lengway.me/pricing" },
      { url: "https://gambit.lengway.me/terms" },
      { url: "https://gambit.lengway.me/challenge" },
    ]);
    expect(robotsPolicy(false)).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: "/api/" },
      sitemap: "https://gambit.lengway.me/sitemap.xml",
    });
  });

  it("excludes mock previews from indexing and sitemap discovery", () => {
    expect(publicMetadata("/", true).robots).toEqual("noindex, nofollow");
    expect(robotsPolicy(true)).toEqual({
      rules: { userAgent: "*", disallow: "/" },
    });
    expect(publicSitemap(true)).toEqual([]);
  });
});
