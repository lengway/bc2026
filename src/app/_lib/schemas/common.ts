import { z } from "zod";
export const Field = z.enum(["sales", "project_management", "software"]);
export const Level = z.enum(["beginner", "intermediate", "advanced"]);
export const CaseType = z.enum(["onboarding", "daily", "weekly"]);
export const Outcome = z.enum(["won", "lost", "left", "incomplete"]);
export const MoveLabel = z.enum([
  "brilliant",
  "best",
  "good",
  "inaccuracy",
  "mistake",
  "blunder",
]);
export const Percent = z.number().min(0).max(100);
export const Count = z.number().int().nonnegative();
