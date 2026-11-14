import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaseView } from "@/contracts";
import backendCase from "@/mocks/fixtures/case-view.json";
import { DocViewer } from "@/ui/doc-viewer";

describe("DocViewer with backend documents", () => {
  it("renders canonical email, CRM, Slack, table and note content", () => {
    const { docs } = CaseView.parse(backendCase);
    render(<>{docs.map((doc) => <DocViewer key={doc.id} doc={doc} />)}</>);
    const email = screen.getByRole("article", { name: "March checkpoint with Dana" });
    expect(within(email).getByText(/to Dana Whitfield/)).toBeInTheDocument();
    const crm = screen.getByRole("article", { name: "Brightline account handoff" });
    expect(within(crm).getByText("Discovery")).toBeInTheDocument();
    expect(within(crm).getByText(/run alongside FleetRoute/)).toBeInTheDocument();
    expect(screen.getByText(/Monthly billing only during the pilot/)).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(within(crm).getByText(/lease renews in June/)).toBeInTheDocument();
    expect(screen.getByText(/Live FleetRoute integration is not in the pilot/)).toBeInTheDocument();
  });

  it("renders numeric and null table cells safely", () => {
    render(<DocViewer doc={{ id: "table", kind: "table", title: "Numbers", arrivesAtTurn: null,
      content: { columns: ["Count", "Unknown"], rows: [[42, null]] } }} />);
    expect(screen.getByRole("cell", { name: "42" })).toBeInTheDocument();
    expect(screen.getAllByRole("cell")).toHaveLength(2);
  });
});
