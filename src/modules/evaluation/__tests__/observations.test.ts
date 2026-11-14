import { describe, expect, it } from 'vitest';
import { prepareSubmission } from '../observations';
import copycat from './golden/copycat.json';
import strong from './golden/strong.json';
import { snapshotFor } from './support';

describe('editor provenance and owner observations', () => {
  it('tracks source-tagged UTF-16 ranges through deletion, replacement and undo', () => {
    const { snapshot } = snapshotFor(copycat, { telemetry: true });
    const source = snapshot.events.find((event) => event.actor === 'copilot')!;
    const messages = snapshot.events.filter((event) => event.actor === 'user' && event.type === 'message');
    messages[0].content = 'A😀Z';
    messages[1].content = 'my own text';
    source.content = 'A😀BC';
    const first = snapshot.drafts[0].events[0];
    Object.assign(first, { kind: 'copilot_insert', sourceEventId: source.id, insertedText: source.content });
    snapshot.drafts[0].events.push(
      { ...first, seq: 2, id: '16000000-0000-4000-8000-000000000102', kind: 'delete', rangeStart: 3, rangeEnd: 5, sourceEventId: null, insertedText: '' },
      { ...first, seq: 3, id: '16000000-0000-4000-8000-000000000103', kind: 'paste', rangeStart: 3, rangeEnd: 3, sourceEventId: null, insertedText: 'Z' },
    );
    Object.assign(snapshot.drafts[1].events[0], { kind: 'paste', insertedText: 'my own text', inputMode: 'unknown' });
    expect(prepareSubmission(snapshot).assistance).toMatchObject({
      totalSubmittedChars: 15, knownCopilotRetainedChars: 3, copilotRetainedPercent: 20,
      unknownPasteCount: 2, unknownPasteChars: 12, observationStatus: 'available',
    });
  });

  it('restores provenance when undo and redo record matching prior text states', () => {
    const { snapshot } = snapshotFor(copycat, { telemetry: true });
    const source = snapshot.events.find((event) => event.actor === 'copilot')!;
    const first = snapshot.drafts[0].events[0];
    Object.assign(first, { kind: 'copilot_insert', sourceEventId: source.id, insertedText: source.content });
    const edit = { ...first, sourceEventId: null, rangeStart: 0, rangeEnd: source.content.length };
    snapshot.drafts[0].events.push(
      { ...edit, seq: 2, id: '16000000-0000-4000-8000-000000000102', kind: 'delete', insertedText: '' },
      { ...edit, seq: 3, id: '16000000-0000-4000-8000-000000000103', kind: 'undo', rangeEnd: 0 },
      { ...edit, seq: 4, id: '16000000-0000-4000-8000-000000000104', kind: 'redo', insertedText: '' },
      { ...edit, seq: 5, id: '16000000-0000-4000-8000-000000000105', kind: 'undo', rangeEnd: 0 },
    );
    expect(prepareSubmission(snapshot).assistance).toMatchObject({
      knownCopilotRetainedChars: source.content.length, observationStatus: 'available',
    });
  });

  it('does not credit unverified source text and does not publish a retained ratio for incomplete drafts', () => {
    const { snapshot } = snapshotFor(copycat, { telemetry: true });
    const source = snapshot.events.find((event) => event.actor === 'copilot')!;
    Object.assign(snapshot.drafts[0].events[0], { kind: 'copilot_insert', sourceEventId: source.id, insertedText: 'Unrelated text' });
    snapshot.drafts[1].events[0].seq = 2;
    expect(prepareSubmission(snapshot).assistance).toMatchObject({
      copilotRetainedPercent: null, knownCopilotRetainedChars: 0, copilotTextSimilarityPercent: 100, observationStatus: 'partial',
    });
  });

  it('reports limited browser observations without labeling touch, IME, punctuation, or synthetic edits as automation', () => {
    const { snapshot } = snapshotFor(strong, { telemetry: true });
    const draft = snapshot.drafts[2];
    draft.interactionWindows[0].pointerTypes = ['touch'];
    draft.interactionWindows[0].untrustedEventCount = 1;
    draft.interactionWindows[0].webdriverReported = null;
    draft.interactionWindows[0].visibleDurationMs = 0;
    draft.interactionWindows[0].capabilityGaps.push('tab hidden');
    draft.events[0].kind = 'composition';
    draft.events[0].inputMode = 'ime';
    draft.events[0].isTrusted = false;
    draft.interactionWindows.push({ ...draft.interactionWindows[0] });
    const { assistance, processObservations } = prepareSubmission(snapshot);
    expect(assistance.observedInputModes).toContain('ime');
    expect(processObservations.automationStatus).toBe('insufficient_data');
    expect(processObservations.signals.filter(({ code }) => code === 'synthetic_editor_event')).toHaveLength(1);
    expect(processObservations.signals.find(({ code }) => code === 'pointer_activity_summary')).toMatchObject({
      observedValue: { pointerTypes: ['touch'], windowsObserved: 4, movementWindowsObserved: 0, pointerMoveSamples: null },
    });
    expect(processObservations.textFeatures[2]).toMatchObject({ punctuationCounts: { emDash: 2 }, languageIssues: null });
  });
});
