import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import {
  AiUseDetails,
  EvidenceList,
  ActivityObservations,
} from "../scoring-details";
import { MoveDetail } from "../move-detail";
import { DocViewer } from "../doc-viewer";
import { docs, moves, persona, evaluation } from "@/app/(design)/design/fixtures";
import { noAiChecks } from "@/mocks/scenarios/sales";
import type { TrapResult } from "@/contracts";

it.each<[TrapResult, string]>([
  ["caught", "Caught"],
  ["missed", "Missed"],
  ["not_presented", "Not presented"],
  ["insufficient_evidence", "Not enough evidence"],
])(
  "renders the %s trap state without conflating it with AI use",
  (trap, label) => {
    render(<AiUseDetails skill={noAiChecks} trap={trap} />);
    expect(screen.getByText(label, { selector: "strong" })).toBeInTheDocument();
    expect(
      screen.queryByText(/AI probability|0% AI|human score/i),
    ).not.toBeInTheDocument();
  },
);
it("does not present an unassessed move as a confirmed grade", () => {
  render(
    <MoveDetail
      move={{
        ...moves[0],
        assessmentStatus: "insufficient_evidence",
        points: null,
      }}
      personaName={persona.name}
      moveNumber={1}
      totalMoves={1}
    />,
  );
  expect(screen.getByText("Not enough evidence")).toBeInTheDocument();
  expect(screen.queryByText("Brilliant")).not.toBeInTheDocument();
});
it("keeps unavailable public document evidence as a quotation", () => {
  render(
    <EvidenceList
      evidence={[
        {
          source: "case_doc",
          sourceId: "private-doc",
          quote: "Discount ceiling: 10%",
          explanation: "Published evidence quotation.",
        },
      ]}
      available={() => false}
      onOpen={() => {
        throw new Error("Must not expose private documents");
      }}
    />,
  );
  expect(screen.getByText(/Discount ceiling/)).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("labels automation observations with limitations instead of assigning an authorship score", () => {
  render(
    <ActivityObservations
      observations={{
        ...evaluation.processObservations,
        automationStatus: "signals_observed",
        signals: [
          {
            code: "webdriver",
            observedValue: true,
            explanation: "Browser reports automation support.",
            limitation: "A browser flag cannot establish authorship.",
          },
        ],
      }}
    />,
  );
  expect(screen.getByText(/cannot establish authorship/)).toBeInTheDocument();
  expect(screen.queryByText(/^bot$|human score/i)).not.toBeInTheDocument();
});
it.each(docs)(
  "renders the $kind document without dropping its title",
  (doc) => {
    render(<DocViewer doc={doc} />);
    expect(
      screen.getByRole("article", { name: doc.title }),
    ).toBeInTheDocument();
  },
);
