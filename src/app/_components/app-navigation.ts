import { SkillId } from "@/contracts/skill-series";
import { APP_NAVIGATION, type AppBreadcrumb } from "@/ui/app-shell";
import { formatSkill } from "@/ui/lib/format";

const settingsLabels = new Map([
  ["learning", "My learning"],
  ["account", "Account"],
  ["billing", "Plan & billing"],
  ["privacy", "Privacy & data"],
]);

export function appBreadcrumbs(
  pathname: string,
  caseTitle?: string,
): AppBreadcrumb[] {
  const [, section, detail] = pathname.split("/");
  if (section === "review")
    return [
      { label: "History", href: "/history" },
      { label: caseTitle ?? "Review" },
    ];
  if (section === "case") return [{ label: caseTitle ?? "Case brief" }];
  if (section === "settings") {
    const label = settingsLabels.get(detail);
    return label
      ? [{ label: "Settings", href: "/settings" }, { label }]
      : [{ label: "Settings" }];
  }
  if (section === "help") return [{ label: "Help" }];
  if (section === "billing") return [{ label: "Plan & billing" }];

  const item = APP_NAVIGATION.find(({ href }) => href === `/${section}`);
  if (!item) return [];
  const skill = section === "path" && SkillId.safeParse(detail);
  return skill && skill.success
    ? [
        { label: item.label, href: item.href },
        { label: formatSkill(skill.data) },
      ]
    : [{ label: item.label }];
}
