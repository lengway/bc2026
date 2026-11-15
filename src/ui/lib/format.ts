import type { Field, Level } from "@/contracts";

/** 259 → "04:19". Negative values clamp to "00:00". */
export function formatClock(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** 259 → "4 minutes 19 seconds", for screen readers. */
export function formatDurationWords(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  if (seconds > 0 || minutes === 0) {
    parts.push(`${seconds} ${seconds === 1 ? "second" : "seconds"}`);
  }
  return parts.join(" ");
}

/** "objection_handling" → "Objection handling". */
export function formatSkill(skill: string): string {
  const words = skill.replace(/[_-]+/g, " ").trim().toLowerCase();
  if (words.length === 0) return "";
  const sentence = words.charAt(0).toUpperCase() + words.slice(1);
  return sentence.replace(/\bai\b/g, "AI");
}

const AVERAGE_ACCURACY_FORMAT = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

export function formatAverageAccuracy(accuracy: number): string {
  return AVERAGE_ACCURACY_FORMAT.format(accuracy / 100);
}

export const FIELD_LABEL: Record<Field, string> = {
  sales: "Sales",
  project_management: "Project management",
  software: "Software",
};

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const OUTCOME_LABEL: Record<string, string> = {
  won: "Deal won",
  lost: "Deal lost",
  left: "Client left",
  incomplete: "Incomplete",
};

/** Maps the contract outcome to display copy. Unknown strings pass through. */
export function formatOutcome(outcome: string): string {
  return OUTCOME_LABEL[outcome] ?? outcome;
}

/** "Dana Whitfield" → "DW". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

const NAME_HONORIFIC = /^(?:dr|mr|mrs|ms|mx|prof)\.?$/i;

/** "Dr. Morgan Lee" → "Morgan". */
export function firstName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.find((part) => !NAME_HONORIFIC.test(part)) ?? parts[0];
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

/** ISO string → "November 14, 2026". UTC, so server and client agree. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE_FORMAT.format(date);
}
