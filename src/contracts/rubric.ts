import { z } from "zod";

/** Server only. Never sent to the client. */
export const Rubric = z.object({
  keyMoments: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      idealMove: z.string(),
      why: z.string(),
    }),
  ),
  traps: z.array(
    z.object({
      id: z.string(),
      injectAtCopilotCall: z.number().int(),
      errorToInject: z.string(),
      howToCatch: z.string(),
    }),
  ),
  twists: z.array(
    z.object({
      id: z.string(),
      trigger: z.union([
        z.object({ afterUserTurn: z.number().int() }),
        z.object({ trustBelow: z.number().int() }),
      ]),
      event: z.object({
        kind: z.enum(["email", "slack", "persona_message"]),
        from: z.string(),
        content: z.string(),
      }),
    }),
  ),
  successCriteria: z.array(z.string()),
});
export type Rubric = z.infer<typeof Rubric>;
