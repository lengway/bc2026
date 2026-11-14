import type { AssistanceProfile, InputMode, ProcessObservations, TextFeatures } from '@/contracts';
import type { SubmittedSnapshot } from '@/modules/simulation';

export type SnapshotEvent = SubmittedSnapshot['events'][number];
type Draft = SubmittedSnapshot['drafts'][number];
type EditorOp = Draft['events'][number];

export const similarityVersion = 'token-jaccard-v1';
const emptyCapture = { complete: false, retained: 0, unknownCount: 0, unknownChars: 0 };
const observationLimit = 'Workspace observations may be incomplete or altered and cannot establish authorship.';

function tokens(text: string): Set<string> {
  return new Set(text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}

function jaccard(left: Set<string>, right: Set<string>) {
  let matches = 0;
  for (const value of left) if (right.has(value)) matches += 1;
  const total = left.size + right.size - matches;
  return total === 0 ? 0 : matches / total;
}

function similarity(messages: SnapshotEvent[], replies: SnapshotEvent[]) {
  if (messages.length === 0) return null;
  const advice = replies.map((reply) => ({ seq: reply.seq, tokens: tokens(reply.content) }));
  const sum = messages.reduce((total, message) => {
    const messageTokens = tokens(message.content);
    let best = 0;
    for (const reply of advice) {
      if (reply.seq >= message.seq) break;
      best = Math.max(best, jaccard(messageTokens, reply.tokens));
    }
    return total + best;
  }, 0);
  return Math.round(100 * sum / messages.length);
}

// The editor and browser offsets count UTF-16 code units.
type TaggedText = { text: string; provenance: string };
type Change = { start: number; removed: TaggedText; inserted: TaggedText };
const replace = (value: string, start: number, end: number, inserted: string) => value.slice(0, start) + inserted + value.slice(end);

function validCopilotInsert(op: EditorOp, move: SnapshotEvent, sources: Map<string, SnapshotEvent>) {
  if (!op.sourceEventId || !op.insertedText.trim()) return false;
  const source = sources.get(op.sourceEventId);
  return !!source && source.seq < move.seq && Date.parse(source.createdAt) <= Date.parse(op.receivedAt) &&
    source.content.includes(op.insertedText);
}

function replay(draft: Draft | undefined, move: SnapshotEvent, sources: Map<string, SnapshotEvent>) {
  if (!draft || draft.events.length === 0) return emptyCapture;
  const edits = [...draft.events].sort((a, b) => a.seq - b.seq);
  let text = '';
  let provenance = '';
  let complete = draft.limitations.length === 0 && draft.closedAt !== null;
  let unknownCount = 0;
  let unknownChars = 0;
  const undo: Change[] = [];
  const redo: Change[] = [];
  for (const [index, edit] of edits.entries()) {
    const { rangeStart, rangeEnd, insertedText, kind } = edit;
    if (edit.seq !== index + 1 || edit.draftId !== draft.draftId ||
        Date.parse(edit.receivedAt) > Date.parse(move.createdAt)) complete = false;
    const tagged = (kind === 'copilot_insert' || kind === 'paste') && validCopilotInsert(edit, move, sources);
    if ((kind === 'paste' || kind === 'copilot_insert') && !tagged) {
      unknownCount += 1;
      unknownChars += insertedText.length;
    }
    if ((edit.sourceEventId || kind === 'copilot_insert') && !tagged) complete = false;
    if (rangeEnd > text.length) {
      complete = false;
      continue;
    }
    const nextText = replace(text, rangeStart, rangeEnd, insertedText);
    if (nextText.length > 32_000) {
      complete = false;
      break;
    }
    if (kind === 'undo' || kind === 'redo') {
      const history = kind === 'undo' ? undo : redo;
      const change = history.at(-1);
      if (change) {
        const from = kind === 'undo' ? change.inserted : change.removed;
        const to = kind === 'undo' ? change.removed : change.inserted;
        const end = change.start + from.text.length;
        if (text.slice(change.start, end) === from.text && replace(text, change.start, end, to.text) === nextText) {
          provenance = replace(provenance, change.start, end, to.provenance);
          text = nextText;
          history.pop();
          (kind === 'undo' ? redo : undo).push(change);
          continue;
        }
      }
      complete = false;
      undo.length = 0;
      redo.length = 0;
    }
    const marks = (tagged ? '1' : '0').repeat(insertedText.length);
    undo.push({ start: rangeStart, removed: { text: text.slice(rangeStart, rangeEnd), provenance: provenance.slice(rangeStart, rangeEnd) },
      inserted: { text: insertedText, provenance: marks } });
    redo.length = 0;
    text = nextText;
    provenance = replace(provenance, rangeStart, rangeEnd, marks);
  }
  complete = complete && text === move.content;
  return { complete, retained: complete ? (provenance.match(/1/g)?.length ?? 0) : 0, unknownCount, unknownChars };
}

function textFeatures(message: SnapshotEvent, draft: Draft | undefined): TextFeatures {
  const punctuation = {
    emDash: '—', enDash: '–', hyphen: '-', period: '.', comma: ',', questionMark: '?',
    exclamationMark: '!', curlyDoubleQuote: /[“”]/g, curlySingleQuote: /[‘’]/g,
  };
  const counts = Object.fromEntries(Object.entries(punctuation).map(([name, value]) => {
    const count = typeof value === 'string' ? message.content.split(value).length - 1 : (message.content.match(value)?.length ?? 0);
    return [name, count];
  }));
  return {
    messageId: message.id, charCount: message.content.length, punctuationCounts: counts,
    listMarkerCount: message.content.match(/^\s*(?:[-*•]|\d+[.)])\s+/gm)?.length ?? 0,
    editCount: draft?.events.length || null, languageIssues: null,
  };
}

function observeProcess(messages: SnapshotEvent[], selectedDrafts: Map<string, Draft>, browser: Draft[], limitations: string[]): ProcessObservations {
  const signals: ProcessObservations['signals'] = [];
  const windows = new Map(browser.flatMap((draft) => draft.interactionWindows.map((window) => [window.id, window] as const)));
  let webdriverSeen = false;
  let limited = windows.size === 0 || messages.some((message) => !selectedDrafts.get(message.id)?.interactionWindows.length);
  for (const window of windows.values()) {
    if (window.webdriverReported === true) {
      webdriverSeen = true;
      signals.push({ code: 'webdriver_reported', observedValue: true, windowId: window.id,
        explanation: 'The browser reported navigator.webdriver in this workspace window.',
        limitation: 'Test tools can set this flag and client observations can be changed. It says nothing about who wrote text.' });
    }
    if (window.webdriverReported === null || window.capabilityGaps.length > 0 || window.visibleDurationMs !== window.durationMs) limited = true;
  }
  for (const draft of browser) {
    const untrusted = draft.events.filter((event) => event.isTrusted === false).length;
    if (draft.limitations.length > 0 || draft.events.some((event) => event.isTrusted === null)) limited = true;
    if (untrusted > 0) signals.push({
      code: 'synthetic_editor_event', observedValue: untrusted, ...(draft.messageEventId ? { messageId: draft.messageEventId } : {}),
      explanation: 'Some editor events reported isTrusted=false.',
      limitation: 'Workspace editing tools and tests may emit synthetic events. This observation alone does not indicate automation or authorship.',
    });
  }
  if (windows.size > 0) {
    const observed = [...windows.values()];
    const sumObserved = (values: (number | null)[]) => {
      const known = values.filter((value) => value !== null);
      return known.length > 0 ? known.reduce((sum, value) => sum + value, 0) : null;
    };
    signals.push({
      code: 'pointer_activity_summary',
      observedValue: {
        windowsObserved: windows.size,
        pointerTypes: [...new Set(observed.flatMap((window) => window.pointerTypes))].sort(),
        movementWindowsObserved: observed.filter((window) => window.pointerMoveSamples !== null).length,
        pointerMoveSamples: sumObserved(observed.map((window) => window.pointerMoveSamples)),
        pointerDownCount: sumObserved(observed.map((window) => window.pointerDownCount)),
        clickCount: sumObserved(observed.map((window) => window.clickCount)),
        wheelCount: sumObserved(observed.map((window) => window.wheelCount)),
        pathLengthNormalized: sumObserved(observed.map((window) => window.pathLengthNormalized)),
        directionChanges: sumObserved(observed.map((window) => window.directionChanges)),
        inputIntervalWindowsObserved: observed.filter((window) => window.inputIntervalSummary !== null).length,
      },
      explanation: 'These totals describe pointer and input observations within captured workspace windows.',
      limitation: 'Coverage and available metrics vary by browser and input method. These totals cannot classify automation or establish authorship.',
    });
  }
  const observed = windows.size > 0 || browser.some((draft) => draft.events.length > 0);
  return {
    rulesVersion: 'workspace-observations-v1',
    observationStatus: !observed ? 'unavailable' : limited ? 'partial' : 'available',
    automationStatus: webdriverSeen ? 'signals_observed' : limited ? 'insufficient_data' : 'no_signals_observed',
    signals, textFeatures: messages.map((message) => textFeatures(message, selectedDrafts.get(message.id))),
    limitations: [observationLimit, 'Language issues were not measured.',
      ...(limited ? ['Some browser windows or event capabilities were unavailable or the workspace was not continuously visible.'] : []),
      ...(limitations.length > 0 ? ['An operation was incomplete when the case was submitted.'] : [])],
  };
}

export function prepareSubmission(snapshot: SubmittedSnapshot) {
  const events = snapshot.events.filter((event) => event.isPublic && event.caseId === snapshot.case.id)
    .sort((a, b) => a.seq - b.seq);
  const messages = events.filter((event) => event.actor === 'user' && event.type === 'message' && event.personaId);
  const replies = events.filter((event) => event.actor === 'copilot' && event.type === 'copilot_reply');
  const sources = new Map(replies.map((source) => [source.id, source]));
  const messageIds = new Map(messages.map((message) => [message.id, message.draftId]));
  const selectedDrafts = new Map<string, Draft>();
  for (const draft of snapshot.drafts) {
    if (draft.messageEventId && messageIds.get(draft.messageEventId) === draft.draftId)
      selectedDrafts.set(draft.messageEventId, draft);
  }
  const observedModes = new Set<InputMode>();
  let retained = 0;
  let observedDrafts = 0;
  let completeDrafts = 0;
  let unknownPasteCount = 0;
  let unknownPasteChars = 0;
  for (const message of messages) {
    const draft = selectedDrafts.get(message.id);
    if (draft?.events.length) observedDrafts += 1;
    for (const event of draft?.events ?? []) observedModes.add(event.inputMode);
    const capture = replay(draft, message, sources);
    if (capture.complete) completeDrafts += 1;
    retained += capture.retained;
    unknownPasteCount += capture.unknownCount;
    unknownPasteChars += capture.unknownChars;
  }
  const totalSubmittedChars = messages.reduce((count, message) => count + message.content.length, 0);
  const observationStatus = observedDrafts === 0 ? 'unavailable' : completeDrafts === messages.length ? 'available' : 'partial';
  const assistance: AssistanceProfile = {
    copilotRequests: events.filter((event) => event.type === 'copilot_prompt' && event.actor === 'user').length,
    knownCopilotRetainedChars: retained, totalSubmittedChars,
    copilotRetainedPercent: observationStatus === 'available' && totalSubmittedChars > 0
      ? Math.round(100 * retained / totalSubmittedChars) : null,
    copilotTextSimilarityPercent: similarity(messages, replies), unknownPasteCount, unknownPasteChars,
    observedInputModes: [...observedModes], observationStatus,
    limitations: [observationLimit,
      ...(observationStatus === 'available' ? [] : ['The editor history for all submitted messages could not be verified.']),
      ...(unknownPasteCount === 0 ? [] : ['The origin of external pasted text is unknown.'])],
  };
  return { snapshot, events, messages, replies, assistance,
    processObservations: observeProcess(messages, selectedDrafts, snapshot.drafts, snapshot.limitations) };
}

export type PreparedSubmission = ReturnType<typeof prepareSubmission>;
