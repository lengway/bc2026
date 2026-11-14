import { describe, expect, it } from "vitest";
import { appBreadcrumbs } from "./app-navigation";

describe("application breadcrumbs", () => {
  it("uses the skill label and links to Skills", () => {
    expect(appBreadcrumbs("/path/objection_handling")).toEqual([
      { label: "Skills", href: "/path" },
      { label: "Objection handling" },
    ]);
  });

  it("uses the case title and links back to History", () => {
    expect(appBreadcrumbs("/review/1", "Renewal at risk")).toEqual([
      { label: "History", href: "/history" },
      { label: "Renewal at risk" },
    ]);
  });

  it("links to the settings index for nested settings", () => {
    expect(appBreadcrumbs("/settings/learning")).toEqual([
      { label: "Settings", href: "/settings" },
      { label: "My learning" },
    ]);
  });
});
