import { z } from 'zod';

export const Id = z.uuid();
export const Timestamp = z.iso.datetime({ offset: true });
export const NonNegativeInt = z.int().nonnegative();
export const PositiveInt = z.int().positive();
export const Percent = z.int().min(0).max(100);
export const NonEmpty = z.string().min(1);

export const Level = z.enum(['beginner', 'intermediate', 'advanced']);
export type Level = z.infer<typeof Level>;
