import type { CaseDoc, CaseView } from "@/contracts";
import { makeCase, scoringGuide } from "./sales";

export const cfoUpdate = {
  document: {
    id: "cfo-update",
    kind: "email_thread",
    title: "Incoming finance update",
    arrivesAtTurn: 2,
    content: {
      subject: "Correction: first-year budget",
      messages: [
        {
          from: "Priya Shah, CFO",
          to: ["Morgan Lee", "RelayWorks account team"],
          sentAt: "2026-11-14T10:15:00.000Z",
          body: "The approved first-year ceiling is $60,000 including implementation and pilot fees. The $120,000 planning figure was never approved. Send me an itemized pilot proposal for review before making any commitment.",
        },
      ],
    },
  } satisfies CaseDoc,
  notice:
    "Priya Shah, CFO, confirmed a $60,000 first-year ceiling. Read the incoming finance update before revising your recommendation.",
};

export const pressureReplies = [
  "We need to reduce missed appointments without disrupting three busy clinics. What would you want to measure?",
  "Finance just sent updated guidance. How would you adjust the proposal given that limit?",
  "A one-clinic pilot sounds workable. Can you send an itemized proposal and describe how we'll measure missed appointments?",
];

export function makePressureCase(id: string): CaseView {
  return {
    ...makeCase(id),
    type: "pressure",
    scoringGuide: {
      ...scoringGuide,
      criteria: [
        scoringGuide.criteria[0],
        {
          id: "verify_pricing",
          title: "Verify finance guidance",
          description:
            "Check the latest finance document before making a proposal or assuming approval.",
        },
      ],
    },
    brief: {
      title: "Northstar Clinics: the budget changed",
      mission: "Verify the commercial facts and recommend a scheduling pilot.",
      yourRole: "Account executive at RelayWorks",
      successLooksLike:
        "Adapt your recommendation to the available budget and agree on a specific finance review.",
      timeLimitSec: 480,
    },
    personas: [
      {
        id: "dr-lee",
        name: "Dr. Morgan Lee",
        role: "Chief Operating Officer",
        company: "Northstar Clinics",
        location: "Portland, OR",
        avatarSeed: "morgan-lee",
        context:
          "Morgan is evaluating a scheduling pilot across three clinics.",
      },
    ],
    docs: [
      {
        id: "crm-record",
        kind: "crm_record",
        title: "Northstar account record",
        arrivesAtTurn: null,
        content: {
          account: "Northstar Clinics",
          contact: "Morgan Lee",
          stage: "Solution review",
          fields: [
            { label: "First-year planning figure", value: "$120,000" },
            { label: "Purchase approval", value: "Not recorded" },
          ],
          notes: ["A six-week pilot at one clinic is operationally feasible."],
        },
      },
    ] satisfies CaseDoc[],
  };
}
