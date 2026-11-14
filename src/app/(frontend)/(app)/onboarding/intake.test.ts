import { describe, expect, it } from "vitest";
import { focusAreasIn } from "@/contracts";
import {
  EMPTY_ANSWERS,
  MAX_FOCUS,
  composeIntakeText,
  readIntakeAnswers,
  toggleFocus,
} from "./intake";

describe("composeIntakeText", () => {
  it("writes every answer on its own labelled line", () => {
    const text = composeIntakeText({
      ...EMPTY_ANSWERS,
      role: "ae",
      experience: "3-5",
      segment: "mid",
      industry: "logistics software",
      strengths: ["discovery"],
      practice: ["pricing", "competition"],
      notes: "I lose deals when a competitor quote shows up.",
    });
    expect(text).toBe(
      [
        "Role: Account executive (account_executive).",
        "Experience: 3–5 years.",
        "Sells to: mid-market in logistics software.",
        "Strong at: Discovery questions.",
        "Wants to practice: Price and discount pressure, Competitor deals.",
        "In their own words: I lose deals when a competitor quote shows up.",
      ].join("\n"),
    );
  });

  it("is empty when nothing was answered", () => {
    expect(composeIntakeText(EMPTY_ANSWERS)).toBe("");
  });

  it("produces text from which the backend reads back exactly the practice areas", () => {
    const text = composeIntakeText({
      ...EMPTY_ANSWERS,
      strengths: ["closing", "discovery"],
      practice: ["renewal", "angry_client"],
    });
    expect([...focusAreasIn(text)].sort()).toEqual(["angry_client", "renewal"]);
  });
});

describe("toggleFocus", () => {
  it("adds, removes and caps the selection", () => {
    let list = toggleFocus([], "pricing");
    expect(list).toEqual(["pricing"]);
    list = toggleFocus(list, "pricing");
    expect(list).toEqual([]);
    const full = toggleFocus(
      toggleFocus(toggleFocus([], "pricing"), "closing"),
      "renewal",
    );
    expect(full).toHaveLength(MAX_FOCUS);
    expect(toggleFocus(full, "discovery")).toBe(full);
  });
});

describe("readIntakeAnswers", () => {
  it("restores structured preferences and preserves multiline notes", () => {
    const answers = {
      ...EMPTY_ANSWERS,
      role: "am",
      experience: "3-5",
      segment: "ent",
      industry: "Medical devices",
      practice: ["discovery"],
      strengths: ["objection_handling"],
      notes: "The first line.\nThe next line.",
    } as const;
    const editable = {
      ...answers,
      practice: [...answers.practice],
      strengths: [...answers.strengths],
    };
    const profile = {
      subfield: "account_management",
      years: 3,
      level: "intermediate" as const,
      intakeText: composeIntakeText(editable),
    };
    expect(readIntakeAnswers(profile)).toEqual(editable);
  });

  it("preserves legacy free-text intake", () => {
    expect(
      readIntakeAnswers({
        subfield: "sdr_outbound",
        years: 2,
        level: "beginner",
        intakeText: "I sell financial software.",
      }),
    ).toMatchObject({
      role: "sdr",
      experience: "1-2",
      notes: "I sell financial software.",
    });
  });
});
