/**
 * Focus areas shared by archetypes (what a case trains) and onboarding (what a person
 * wants to practice). Onboarding writes the labels into the intake text, which is stored
 * verbatim as `profile.intakeText`, so matching does not depend on the LLM parse.
 */
export const FOCUS_AREAS = {
  discovery: { label: 'Discovery questions', keywords: ['discovery', 'question', 'qualif', 'needs'] },
  objection_handling: { label: 'Handling objections', keywords: ['objection', 'pushback'] },
  pricing: { label: 'Price and discount pressure', keywords: ['price', 'pricing', 'discount', 'expensive'] },
  negotiation: { label: 'Negotiation', keywords: ['negotiat', 'terms'] },
  value_articulation: { label: 'Explaining value and ROI', keywords: ['value', 'roi', 'business case'] },
  closing: { label: 'Closing and next steps', keywords: ['closing', 'close the', 'next step', 'commit'] },
  competition: { label: 'Competitor deals', keywords: ['competitor', 'competition', 'incumbent', 'vendor'] },
  renewal: { label: 'Renewals and churn risk', keywords: ['renewal', 'churn', 'retention'] },
  angry_client: { label: 'Upset or angry clients', keywords: ['angry', 'upset', 'unhappy', 'escalat', 'outage'] },
  multi_threading: { label: 'Several stakeholders', keywords: ['stakeholder', 'committee', 'multi-thread', 'champion'] },
  procurement: { label: 'Procurement and legal', keywords: ['procurement', 'legal', 'contract'] },
  cold_outreach: { label: 'Cold outreach', keywords: ['cold', 'outbound', 'prospect'] },
  follow_up: { label: 'Follow-ups and no-shows', keywords: ['follow-up', 'follow up', 'no-show', 'ghost'] },
  upsell: { label: 'Upsell and expansion', keywords: ['upsell', 'expansion', 'cross-sell'] },
} as const;

export type FocusArea = keyof typeof FOCUS_AREAS;
export const FOCUS_AREA_IDS = Object.keys(FOCUS_AREAS) as FocusArea[];

/** Focus areas the person asked to practice, read from the "Wants to practice" line if present, else the whole text. */
export function focusAreasIn(text: string): Set<FocusArea> {
  const practiceLine = /wants to practice:([^\n]*)/i.exec(text)?.[1];
  const haystack = (practiceLine ?? text).toLowerCase();
  const found = new Set<FocusArea>();
  for (const id of FOCUS_AREA_IDS) {
    const { label, keywords } = FOCUS_AREAS[id];
    if (haystack.includes(label.toLowerCase()) || keywords.some((word) => haystack.includes(word))) found.add(id);
  }
  return found;
}
