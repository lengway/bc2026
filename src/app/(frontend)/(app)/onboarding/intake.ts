import {
  FOCUS_AREAS,
  type FocusArea,
  type IntakeRequest,
  type Level,
} from "@/contracts";

export const ROLES = [
  {
    id: "sdr",
    label: "SDR / BDR",
    detail: "Outbound, first calls, booking meetings",
    text: "SDR / BDR (sdr_outbound)",
  },
  {
    id: "ae",
    label: "Account executive",
    detail: "Discovery to signed deal",
    text: "Account executive (account_executive)",
  },
  {
    id: "am",
    label: "Account manager",
    detail: "Renewals, expansion, keeping clients",
    text: "Account manager (account_management)",
  },
] as const;
export type RoleId = (typeof ROLES)[number]["id"];

export const EXPERIENCE = [
  { id: "lt1", label: "Under 1 year", years: 0, level: "beginner" },
  { id: "1-2", label: "1–2 years", years: 1, level: "beginner" },
  { id: "3-5", label: "3–5 years", years: 3, level: "intermediate" },
  { id: "6+", label: "6+ years", years: 6, level: "advanced" },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  years: number;
  level: Level;
}>;
export type ExperienceId = (typeof EXPERIENCE)[number]["id"];

export const SEGMENTS = [
  { id: "smb", label: "Small business" },
  { id: "mid", label: "Mid-market" },
  { id: "ent", label: "Enterprise" },
] as const;
export type SegmentId = (typeof SEGMENTS)[number]["id"];

/** Areas offered as chips, in display order. A subset of the shared focus taxonomy. */
export const FOCUS_CHOICES: readonly FocusArea[] = [
  "discovery",
  "objection_handling",
  "pricing",
  "negotiation",
  "value_articulation",
  "closing",
  "competition",
  "renewal",
  "angry_client",
  "multi_threading",
  "cold_outreach",
  "follow_up",
];

export const MAX_FOCUS = 3;

export type IntakeAnswers = {
  role: RoleId | null;
  experience: ExperienceId | null;
  level: Level;
  segment: SegmentId | null;
  industry: string;
  strengths: FocusArea[];
  practice: FocusArea[];
  notes: string;
};

export const EMPTY_ANSWERS: IntakeAnswers = {
  role: null,
  experience: null,
  level: "intermediate",
  segment: null,
  industry: "",
  strengths: [],
  practice: [],
  notes: "",
};

const label = (area: FocusArea) => FOCUS_AREAS[area].label;

/**
 * Turns the structured answers into the intake text the backend stores and parses.
 * Fixed line prefixes ("Wants to practice:") are read back when picking a case, so keep them stable.
 */
export function composeIntakeText(answers: IntakeAnswers): string {
  const lines: string[] = [];
  const role = ROLES.find((r) => r.id === answers.role);
  const experience = EXPERIENCE.find((e) => e.id === answers.experience);
  const segment = SEGMENTS.find((s) => s.id === answers.segment);
  const industry = answers.industry.trim();

  if (role) lines.push(`Role: ${role.text}.`);
  if (experience) lines.push(`Experience: ${experience.label}.`);
  if (segment || industry) {
    lines.push(
      `Sells to: ${[segment?.label.toLowerCase(), industry && `in ${industry}`].filter(Boolean).join(" ")}.`,
    );
  }
  if (answers.strengths.length)
    lines.push(`Strong at: ${answers.strengths.map(label).join(", ")}.`);
  if (answers.practice.length)
    lines.push(`Wants to practice: ${answers.practice.map(label).join(", ")}.`);
  const notes = answers.notes.trim();
  if (notes) lines.push(`In their own words: ${notes}`);
  return lines.join("\n");
}

export function composeIntakeRequest(answers: IntakeAnswers): IntakeRequest {
  return {
    field: "sales",
    text: composeIntakeText(answers),
    level: answers.level,
    years: EXPERIENCE.find(({ id }) => id === answers.experience)?.years,
  };
}

/** Adds or removes an area, keeping at most MAX_FOCUS and never the same area in both lists. */
export function toggleFocus(
  list: FocusArea[],
  area: FocusArea,
  blocked: readonly FocusArea[] = [],
): FocusArea[] {
  if (list.includes(area)) return list.filter((a) => a !== area);
  if (list.length >= MAX_FOCUS || blocked.includes(area)) return list;
  return [...list, area];
}

/** Restores onboarding's structured answers and retains older free-text profiles as notes. */
export function readIntakeAnswers(
  profile: Pick<
    import("@/contracts").Profile,
    "subfield" | "level" | "years" | "intakeText"
  > | null,
): IntakeAnswers {
  if (!profile) return EMPTY_ANSWERS;
  const { intakeText, level, subfield, years } = profile;
  const noteMarker = /(?:^|\n)In their own words: /.exec(intakeText);
  const structured = noteMarker
    ? intakeText.slice(0, noteMarker.index)
    : intakeText;
  const notes = noteMarker
    ? intakeText.slice(noteMarker.index + noteMarker[0].length)
    : undefined;
  const lines = structured.split("\n");
  const read = (prefix: string) =>
    lines
      .find((line) => line.startsWith(prefix))
      ?.slice(prefix.length)
      .replace(/\.$/, "") ?? "";
  const customer = read("Sells to: ");
  const segment = SEGMENTS.find(
    ({ label }) =>
      customer === label.toLowerCase() ||
      customer.startsWith(`${label.toLowerCase()} in `),
  );
  const industry = (
    segment ? customer.slice(segment.label.length).trimStart() : customer
  ).replace(/^in /, "");
  const choices = (prefix: string) => {
    const selected = read(prefix).split(", ");
    return FOCUS_CHOICES.filter((area) => selected.includes(label(area)));
  };
  const role =
    ROLES.find(({ text }) => text === read("Role: ")) ??
    ROLES.find(({ text }) => text.endsWith(`(${subfield})`));
  const experience =
    EXPERIENCE.find(({ label }) => label === read("Experience: ")) ??
    (years === null
      ? undefined
      : EXPERIENCE.findLast((entry) => years >= entry.years));
  return {
    role: role?.id ?? null,
    experience: experience?.id ?? null,
    level,
    segment: segment?.id ?? null,
    industry,
    strengths: choices("Strong at: "),
    practice: choices("Wants to practice: "),
    notes:
      notes ??
      (lines.some((line) =>
        /^(Role|Experience|Sells to|Strong at|Wants to practice): /.test(line),
      )
        ? ""
        : intakeText),
  };
}
