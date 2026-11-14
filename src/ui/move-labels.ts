import type { MoveLabel } from "@/contracts";

export type MoveLabelMeta = {
  /** Chess-style annotation. Always shown next to the color. */
  glyph: string;
  name: string;
  /** Text + soft background, for badges. */
  badgeClassName: string;
  /** Solid fill, for chart points. */
  dotClassName: string;
  /** Text only, for annotations on charts. */
  textClassName: string;
  /** Does this move deserve a callout on the trust curve. */
  notable: boolean;
  /** Positive labels are annotated above the point, negative ones below. */
  tone: "positive" | "neutral" | "negative";
};

/** Best to worst. Shared scale — CONTEXT.md §14. */
export const MOVE_LABEL_ORDER: readonly MoveLabel[] = [
  "brilliant",
  "best",
  "good",
  "inaccuracy",
  "mistake",
  "blunder",
];

export const MOVE_LABEL_META: Record<MoveLabel, MoveLabelMeta> = {
  brilliant: {
    glyph: "!!",
    name: "Brilliant",
    badgeClassName: "bg-label-brilliant-soft text-label-brilliant",
    dotClassName: "bg-label-brilliant",
    textClassName: "text-label-brilliant",
    notable: true,
    tone: "positive",
  },
  best: {
    glyph: "!",
    name: "Best",
    badgeClassName: "bg-label-best-soft text-label-best",
    dotClassName: "bg-label-best",
    textClassName: "text-label-best",
    notable: false,
    tone: "positive",
  },
  good: {
    glyph: "—",
    name: "Good",
    badgeClassName: "bg-label-good-soft text-label-good",
    dotClassName: "bg-label-good",
    textClassName: "text-label-good",
    notable: false,
    tone: "neutral",
  },
  inaccuracy: {
    glyph: "?!",
    name: "Inaccuracy",
    badgeClassName: "bg-label-inaccuracy-soft text-label-inaccuracy",
    dotClassName: "bg-label-inaccuracy",
    textClassName: "text-label-inaccuracy",
    notable: false,
    tone: "negative",
  },
  mistake: {
    glyph: "?",
    name: "Mistake",
    badgeClassName: "bg-label-mistake-soft text-label-mistake",
    dotClassName: "bg-label-mistake",
    textClassName: "text-label-mistake",
    notable: true,
    tone: "negative",
  },
  blunder: {
    glyph: "??",
    name: "Blunder",
    badgeClassName: "bg-label-blunder-soft text-label-blunder",
    dotClassName: "bg-label-blunder",
    textClassName: "text-label-blunder",
    notable: true,
    tone: "negative",
  },
};
