import { z } from 'zod';
import { Field, Level } from './case';
import { Id, NonEmpty, NonNegativeInt, Timestamp } from './primitives';

const DailyGoal = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type DailyGoal = z.infer<typeof DailyGoal>;

export const IntakeRequest = z.strictObject({
  text: z.string().trim().max(8_000),
  field: Field,
  level: Level,
  years: z.int32().nonnegative().optional(),
  dailyGoal: DailyGoal.optional(),
});
export type IntakeRequest = z.infer<typeof IntakeRequest>;

export const IntakeDetails = z.object({
  subfield: NonEmpty,
  years: NonNegativeInt.nullable(),
  pains: z.array(NonEmpty),
  goals: z.array(NonEmpty),
});
export type IntakeDetails = z.infer<typeof IntakeDetails>;

export const Profile = IntakeDetails.extend({
  userId: Id,
  intakeText: z.string(),
  field: Field,
  level: Level,
  updatedAt: Timestamp,
  dailyGoal: DailyGoal.default(1),
});
export type Profile = z.infer<typeof Profile>;
