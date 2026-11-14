import { z } from "zod";
import { NonEmpty, NonNegativeInt, Percent } from "@/contracts/primitives";
import type { SubmittedSnapshot } from "@/modules/simulation";

const RecordedState = z.object({
  turn: NonNegativeInt,
  trust: Percent,
  patience: NonNegativeInt,
  mood: z.string(),
  revealed: z.array(z.string()),
  outcome: z.null(),
});

export function buildRetakeContext(
  snapshot: SubmittedSnapshot,
  eventId: string,
  criterionId: string,
  recordedState: unknown,
) {
  const state = RecordedState.safeParse(recordedState);
  const events = snapshot.events.filter((event) => event.isPublic);
  const source = events.find(
    (event) =>
      event.id === eventId &&
      event.type === "message" &&
      event.actor === "user",
  );
  if (!state.success || !source?.personaId) return null;
  const persona = snapshot.case.personas.find(
    (item) => item.public.id === source.personaId,
  );
  const criterion = snapshot.case.scoringGuide.criteria.find(
    (item) => item.id === criterionId,
  );
  const reaction = events.find(
    (event) =>
      event.actor === "persona" &&
      event.type === "message" &&
      event.seq > source.seq &&
      event.personaId === source.personaId &&
      event.meta.replyToEventId === eventId,
  );
  const docIds = z.array(NonEmpty).safeParse(source.meta.availableDocumentIds);
  if (!persona || !criterion || !reaction || !docIds.success) return null;
  const availableDocs = snapshot.case.docs.filter((doc) =>
    docIds.data.includes(doc.id),
  );
  if (availableDocs.length !== new Set(docIds.data).size) return null;

  const project = ({
    id,
    seq,
    actor,
    personaId,
    type,
    content,
  }: typeof source) => ({ id, seq, actor, personaId, type, content });
  const history = events
    .filter((event) => event.seq < source.seq)
    .sort((a, b) => a.seq - b.seq)
    .map(project);
  const visibleToBuyer = history.filter(
    (event) => event.actor !== "copilot" && event.type !== "copilot_prompt",
  );
  return {
    before: { answer: source.content, reaction: reaction.content },
    personaInput: (answer: string, practiceId: string) => ({
      persona: persona.public,
      hidden: persona.hidden,
      state: state.data,
      history: [
        ...visibleToBuyer,
        { ...project(source), id: practiceId, content: answer },
      ],
      availableDocs,
    }),
    feedbackInput: (answer: string) => ({
      criterion,
      brief: snapshot.case.brief,
      history,
      availableDocs,
      originalAnswer: source.content,
      revisedAnswer: answer,
    }),
    personaName: persona.public.name,
    criterionTitle: criterion.title,
  };
}
