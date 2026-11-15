export type ChallengeChoice = {
  label: string;
  correct: boolean;
};

export type ChallengeScenario = {
  title: string;
  context: string;
  copilotClaim: string;
  documentTitle: string;
  documentMeta: string;
  documentLines: { label: string; value: string; highlight?: boolean }[];
  prompt: string;
  choices: ChallengeChoice[];
  evidence: string;
  explanation: string;
  consequence: string;
};

export const challengeScenarios: ChallengeScenario[] = [
  {
    title: "The terms don't match",
    context:
      "A new customer says their procurement lead approved 60-day payment terms on the call. Your copilot suggests you reassure them that the change is routine.",
    copilotClaim:
      "Net 60 is standard for an account this size. You can confirm it now and update the paperwork later.",
    documentTitle: "Executed order form",
    documentMeta: "Northstar Labs · Order 24-118 · Signed 12 March",
    documentLines: [
      { label: "Payment terms", value: "Net 30 from invoice date", highlight: true },
      { label: "Annual commitment", value: "$48,000, billed annually" },
      { label: "Amendments", value: "Changes require written approval from both parties" },
    ],
    prompt: "What do you say to the customer?",
    choices: [
      { label: "Reassure them that Net 60 is fine and promise to update the form.", correct: false },
      { label: "Acknowledge the request, point to the signed Net 30 term, and offer to confirm an amendment with finance before committing.", correct: true },
      { label: "Tell them the signed form is final and ask them to pay today.", correct: false },
    ],
    evidence: "“Net 30 from invoice date” — Executed order form, Payment terms.",
    explanation:
      "The signed order form sets Net 30. The copilot's claim that Net 60 is standard is not approval to change a signed commercial term.",
    consequence:
      "If you promise Net 60, the customer may rely on a concession you cannot approve. Confirm the request internally, then document any agreed change in writing.",
  },
  {
    title: "The renewal promise",
    context:
      "A customer asks to cancel next month, saying your teammate promised they could leave at any time. Your copilot says to preserve the relationship and confirm the cancellation.",
    copilotClaim:
      "They have a good relationship with us, so a flexible exit is probably fine. Confirm the cancellation and sort out the contract later.",
    documentTitle: "Subscription agreement",
    documentMeta: "Pine Street Studio · Agreement PS-440 · Signed 3 May",
    documentLines: [
      { label: "Initial term", value: "12 months, beginning 1 June", highlight: true },
      { label: "Renewal", value: "Renews for 12 months unless either party gives 30 days' notice before renewal" },
      { label: "Early termination", value: "No early termination for convenience" },
    ],
    prompt: "How should you respond?",
    choices: [
      { label: "Confirm the cancellation immediately because a teammate may have approved it.", correct: false },
      { label: "Explain what the signed term says, ask for any written exception they have, and offer to review options with your manager.", correct: true },
      { label: "Tell them they cannot cancel and close the conversation.", correct: false },
    ],
    evidence: "“12 months, beginning 1 June” and “No early termination for convenience” — Subscription agreement.",
    explanation:
      "The agreement has a 12-month initial term and no convenience termination. An unrecorded verbal promise could matter, but it needs to be checked rather than assumed.",
    consequence:
      "Confirming cancellation without checking may waive revenue or create an inconsistent record. Acknowledge their understanding and investigate the alleged exception before committing.",
  },
  {
    title: "The integration gap",
    context:
      "A buyer expects a custom payroll integration to be included because your copilot says the package covers integrations. The signed scope lists only standard connectors.",
    copilotClaim:
      "The Business package includes integrations. Tell them the payroll connection is covered so procurement can keep moving.",
    documentTitle: "Statement of work · Appendix A",
    documentMeta: "Cedar & Row · SOW-091 · Version 2.1",
    documentLines: [
      { label: "Included connectors", value: "Standard connectors listed in the product catalog", highlight: true },
      { label: "Custom development", value: "Excluded unless added by a signed change order" },
      { label: "Customer systems", value: "Payroll platform connection not listed" },
    ],
    prompt: "What is the most useful next reply?",
    choices: [
      { label: "Tell them the payroll integration is included and let delivery work out the details.", correct: false },
      { label: "Clarify that the current scope lists standard connectors, ask which payroll system they need, and offer to scope a change order with delivery.", correct: true },
      { label: "Say integrations are excluded and end the discussion.", correct: false },
    ],
    evidence: "“Custom development excluded unless added by a signed change order” — Statement of work, Appendix A.",
    explanation:
      "The scope covers standard connectors and excludes custom work unless the parties sign a change order. The payroll platform is not named in the included list.",
    consequence:
      "Calling it included can create a delivery commitment with no agreed scope, owner, or price. Clarify the need and get delivery to size it before offering terms.",
  },
];
