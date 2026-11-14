import type { PersonaOutcome } from '@/contracts/case';
import type { GeneratedCase } from '@/modules/llm';
import type { Rubric } from '@/contracts/rubric';

const CFO_UPDATE_TURN = 2;

// A fixed, internally consistent case used for the dedicated Pressure launch.
export const pressureScenario: { generated: GeneratedCase; rubric: Rubric; archetypeId: string; model: string; promptVersion: string; seed: string } = {
  archetypeId: 'pressure-budget-reversal', model: 'curated', promptVersion: 'pressure.v1', seed: 'pressure-v1',
  generated: {
    brief: { title: 'Northstar Clinics: the budget changed', mission: 'Understand the clinic group’s scheduling problem, verify the commercial facts, and recommend a next step that fits the latest approved budget.', yourRole: 'Account executive at RelayWorks', successLooksLike: 'A grounded recommendation that acknowledges the new budget, checks the relevant documents, and agrees a practical next step with an owner and date.', timeLimitSec: 480 },
    personas: [{ public: { id: 'dr-lee', name: 'Dr. Morgan Lee', role: 'Chief Operating Officer', company: 'Northstar Clinics', location: 'Portland, OR', avatarSeed: 'morgan-lee', context: 'Morgan is evaluating a scheduling workflow across three clinics and has limited time.' }, hidden: { personality: 'Decisive but careful about patient disruption', style: 'Short, direct questions; appreciates clear tradeoffs. Keep the conversation open until the seller has had a chance to respond to the written finance update.', realMotive: 'Reduce missed appointments without disrupting clinic operations or committing funds that finance has not approved.', constraints: ['Three clinics must remain operational during rollout', 'The team has no capacity for a broad process redesign this quarter', 'The approved first-year ceiling changes in the incoming CFO email'], triggersOpen: ['Asking how missed appointments are measured', 'Offering a small, reversible pilot', 'Checking current finance guidance before recommending spend'], triggersClose: ['Treating a draft quote as approval', 'Ignoring the new CFO limit', 'Promising patient outcomes without evidence'], knows: ['The three clinics logged 410 missed appointments last quarter', 'A small pilot at one clinic is operationally feasible'], willNeverSayFirst: ['Finance has withdrawn the earlier budget approval'], patience: 7, initialTrust: 55 } }],
    docs: [
      { id: 'email-thread', kind: 'email_thread', title: 'Project correspondence', arrivesAtTurn: null, content: { subject: 'Scheduling workflow review', messages: [{ from: 'Morgan Lee <mlee@northstar.example>', to: ['You <alex@relayworks.example>'], sentAt: '2026-10-12T15:00:00.000Z', body: 'We are looking at missed appointments across our three clinics. Please come prepared to discuss a contained first step. We cannot take on a major workflow change before year end.\n\nMorgan Lee\nChief Operating Officer | Northstar Clinics' }] } },
      { id: 'crm-record', kind: 'crm_record', title: 'Account record · last updated Oct 8', arrivesAtTurn: null, content: { account: 'Northstar Clinics', contact: 'Morgan Lee', stage: 'Solution review', fields: [{ label: 'Missed appointments', value: '410 across three clinics last quarter (customer-reported; not independently audited)' }, { label: 'Draft annual subscription', value: '$96,000' }, { label: 'Draft implementation', value: '$18,000' }, { label: 'Earlier budget note', value: 'Finance discussed up to $120,000 for year one; approval not recorded' }], notes: ['No purchase approval is attached to this record.', 'A one-clinic, six-week pilot is operationally possible, subject to finance approval.'] } },
      { id: 'pilot-plan', kind: 'note', title: 'Draft pilot outline', arrivesAtTurn: null, content: { text: 'One clinic · six weeks · measure missed appointment rate against the clinic’s prior eight-week baseline. RelayWorks would configure the scheduling workflow; Northstar would nominate one operations owner and review weekly reports. This is a draft outline, not an approved scope or outcome guarantee.' } },
      { id: 'cfo-update', kind: 'email_thread', title: 'Incoming finance update', arrivesAtTurn: CFO_UPDATE_TURN + 1, content: { subject: 'Correction: Northstar FY27 first-year limit', messages: [{ from: 'Priya Shah <pshah@northstar.example>', to: ['Morgan Lee <mlee@northstar.example>', 'You <alex@relayworks.example>'], sentAt: '2026-10-14T16:20:00.000Z', body: 'Morgan, Alex — I need to correct the earlier planning note. The approved first-year spend ceiling is $60,000, including implementation and any pilot fees. The $120,000 figure was a planning scenario and was never approved. Please do not treat the draft quote as authorization. If the team wants to proceed, bring me a revised, itemized pilot proposal at or below $60,000 for review; no commitment is approved yet.\n\nPriya Shah\nChief Financial Officer | Northstar Clinics' }] } },
    ],
  },
  rubric: {
    version: 'pressure.v1',
    criteria: [
      { id: 'discovery', title: 'Discovery', description: 'Clarify operational impact, measurement, and decision process.', required: true },
      { id: 'objection_handling', title: 'Objection handling', description: 'Respond to the finance update and operational constraints accurately.', required: true },
      { id: 'value_articulation', title: 'Value articulation', description: 'Relate a feasible pilot to customer priorities without unsupported claims.', required: true },
      { id: 'critical_ai_use', title: 'Critical use of AI', description: 'Verify material copilot claims against case evidence.', required: true },
      { id: 'closing', title: 'Closing', description: 'Agree a bounded next step with an owner, timing, and agenda.', required: true },
    ],
    aiUseChecks: [{ id: 'quote-verification', criterionId: 'critical_ai_use', description: 'Do not present the draft quote or planning note as approved spend; after the CFO email, use the $60,000 ceiling and preserve approval status.', maxPoints: 20, passConditions: ['Checks the CRM and then the CFO email', 'Uses $60,000 as the inclusive ceiling', 'States the revised proposal still requires CFO review'], failureConditions: ['Repeats $120,000 as approved', 'Claims the $96,000 subscription is authorized', 'Treats a revised proposal as approval'], sourceRefs: ['crm-record', 'cfo-update'] }],
    keyMoments: [
      { id: 'measure-impact', description: 'Clarify what the 410 missed appointments mean and how Northstar tracks them.', idealMove: 'Ask about baseline, definition, and operational impact before claiming value.', why: 'The account count is customer-reported and unaudited.' },
      { id: 'check-approval', description: 'Distinguish the draft quote and planning note from approved budget.', idealMove: 'Verify the account record and ask who owns financial approval.', why: 'The CRM explicitly says approval is not recorded.' },
      { id: 'react-to-update', description: 'Reconcile the CFO’s correction with the prior plan.', idealMove: 'Acknowledge the $60,000 inclusive ceiling, retract any assumption of approval, and re-scope.', why: 'The new email changes the viable commercial path.' },
      { id: 'pilot-fit', description: 'Offer an operationally contained pilot without guaranteeing results.', idealMove: 'Use the one-clinic six-week outline and propose measures, not promised outcomes.', why: 'Northstar has limited capacity and needs a reversible first step.' },
      { id: 'next-step', description: 'Close with a decision process that keeps finance approval explicit.', idealMove: 'Agree who will prepare and review an itemized proposal, by when, and against which measures.', why: 'A draft proposal is not a purchase commitment.' },
    ],
    traps: [{ id: 'overstated-budget', injectAtCopilotCall: 1, errorToInject: 'The CRM says $120,000 is approved, so you can position the $96,000 subscription and $18,000 implementation as within budget.', howToCatch: 'The CRM labels $120,000 a planning scenario with no approval; the later CFO email explicitly sets a $60,000 inclusive ceiling.' }],
    twists: [{ id: 'cfo-budget-correction', documentIds: ['cfo-update'], trigger: { afterUserTurn: CFO_UPDATE_TURN }, event: { kind: 'email', from: 'Priya Shah, CFO', content: 'Incoming email from Northstar CFO Priya Shah: the first-year spend ceiling is $60,000 including implementation; the $120,000 figure was never approved. A revised itemized pilot proposal may be submitted for review, but no commitment is approved.' } }],
    successCriteria: ['Accurately distinguish planning from approval.', 'Change recommendation after the CFO update.', 'Use a bounded pilot and evidence-based measures.', 'Agree a specific proposal review step with finance.'],
  },
};

export function resolvePressureOutcome(seed: string | null, turn: number, outcome: PersonaOutcome | null) {
  return seed === pressureScenario.seed && turn <= CFO_UPDATE_TURN ? null : outcome;
}
