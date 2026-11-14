import { DemoCase, type CatalogService } from '@/modules/catalog';
import type { MoveLabel } from '@/contracts';

export const scenarios = [
  {
    archetypeId: 'price-objection', name: 'June Rivera', company: 'Northfield Foods',
    concern: 'We like the forecast, but the proposed price strains our budget.',
    response: 'Does the subscription or the one-time implementation put the most pressure on the budget?',
    detail: 'The one-time cost is the immediate issue. Finance will ask what we can learn from a smaller rollout.',
    nextStep: 'Could you and Finance meet Thursday to agree on a single-center pilot, a stockout baseline and an implementation cap?',
    agreement: 'I can bring Finance on Thursday. I will share the current stockout baseline before the meeting.',
  },
  {
    archetypeId: 'procurement', name: 'Samira Vega', company: 'Granite Valley Foods',
    concern: 'Operations approved the proposal, but procurement has put the purchase on hold.',
    response: 'Which approval is holding the purchase, and what could Operations prepare before procurement reviews it?',
    detail: 'The procurement lead needs a breakdown of the fees and the deployment obligations.',
    nextStep: 'I will send the fee breakdown and deployment responsibilities today. Could you introduce us to procurement for a 20-minute review on Tuesday?',
    agreement: 'I will make the introduction today and put Tuesday on the calendar.',
  },
  {
    archetypeId: 'committee', name: 'Jordan Wells', company: 'Harborline Logistics',
    concern: 'I support this pilot, but dispatch and finance disagree about what success would look like.',
    response: 'What does each group need to see before it can support the pilot?',
    detail: 'Dispatch wants fewer check-in calls. Finance wants a fixed monthly charge and a decision date.',
    nextStep: 'Could you invite both teams to a 20-minute meeting on Wednesday? I will bring the fixed fee and a proposed baseline for check-in calls.',
    agreement: 'Yes. I will send the invite and have dispatch bring last week’s call counts.',
  },
  {
    archetypeId: 'demo-no-show', name: 'Marten Blake', company: 'Canyon Freight',
    concern: 'I missed the demo. The dispatch team is busy and cannot sit through a full presentation this week.',
    response: 'What timing and format would make it useful for dispatch to take another look?',
    detail: 'I can spare 15 minutes Friday if the demo shows how a dispatcher finds a late tractor.',
    nextStep: 'I will send a 15-minute Friday invite with one late-tractor example. Could you bring a dispatcher who can tell us whether it fits their workflow?',
    agreement: 'Friday works. I will invite the dispatcher who covers our busiest shift.',
  },
];

export async function loadScenario(catalog: CatalogService, pack: Awaited<ReturnType<CatalogService['getPack']>>, scenario: typeof scenarios[number]) {
  const archetype = pack.archetypes.find(({ id }) => id === scenario.archetypeId);
  if (!archetype) throw new Error(`Missing demo archetype: ${scenario.archetypeId}`);
  const source = await catalog.getDemoCase(pack.field, archetype.subfield);
  const { public: persona } = source.personas[0];
  // Rename the fictional account throughout its brief, documents and persona so each case has its own buyer.
  const demo = DemoCase.parse(JSON.parse(JSON.stringify(source)
    .replaceAll(persona.name, scenario.name)
    .replaceAll(persona.company, scenario.company)
    .replaceAll(persona.avatarSeed, scenario.name.toLowerCase().replaceAll(' ', '-'))));
  const crm = demo.case.docs.find((doc) => doc.kind === 'crm_record');
  const term = crm?.content.fields.find(({ label }) => label === 'Commercial terms')?.value;
  if (!crm || !term) throw new Error(`Missing demo commercial terms: ${archetype.id}`);
  const concern = demo.personas[0].hidden.realMotive;
  const turns = [
    {
      criterion: 'discovery', label: 'good', trust: 50,
      content: 'Before we discuss the proposal, what decision can you make this month and how do you measure the problem today?',
      reply: concern,
      why: 'The question establishes the decision and asks for a measurable starting point.',
    },
    {
      criterion: 'objection_handling', label: 'best', trust: 63,
      content: scenario.response, reply: scenario.detail,
      why: 'The response asks what is blocking approval and clarifies a constraint the next step can address.',
    },
    {
      criterion: 'value_articulation', label: 'good', trust: 73,
      content: 'Let’s start with the workflow you described and agree on a baseline so the team can measure what changes before committing to a rollout.',
      reply: 'That would give us something practical to review. What are the commercial terms?',
      why: 'The proposal connects the next step to a customer outcome and leaves room to define a measurable baseline.',
    },
    {
      criterion: 'critical_ai_use', label: 'best', trust: 83,
      content: `I checked the CRM terms. ${term}`,
      reply: 'Thanks for confirming. That is what I have on file.',
      why: 'The response uses the documented commercial terms after the copilot supplied a conflicting claim.',
    },
    {
      criterion: 'closing', label: 'brilliant', trust: 96,
      content: scenario.nextStep, reply: scenario.agreement,
      why: 'The move secures a concrete meeting with a time, an owner and preparation tied to the buyer’s concern.',
    },
  ] satisfies { criterion: string; label: MoveLabel; trust: number; content: string; reply: string; why: string }[];
  return { archetype, demo, crmId: crm.id, term, turns };
}
