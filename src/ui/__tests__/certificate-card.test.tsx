import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { certificateFull, certificateLimited } from "@/app/design/fixtures";
import { CertificateCard } from "@/ui/certificate-card";

describe("CertificateCard", () => {
  it("renders the summary of a limited certificate without the moves section", () => {
    render(<CertificateCard certificate={certificateLimited} />);

    expect(screen.getByText("Maya Okafor")).toBeInTheDocument();
    expect(screen.getByText("Objection handling")).toBeInTheDocument();
    expect(screen.getByText("Deal won")).toBeInTheDocument();
    expect(screen.getByText("7F3K-2291")).toBeInTheDocument();
    expect(screen.getByText("Recorded simulation")).toBeInTheDocument();

    expect(
      screen.queryByRole("region", { name: "Key moves" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Trust curve" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: /move$/ }),
    ).not.toBeInTheDocument();
  });

  it("adds the three key moves and the trust curve to a full certificate", () => {
    render(<CertificateCard certificate={certificateFull} />);

    const keyMoves = screen.getByRole("region", { name: "Key moves" });
    expect(within(keyMoves).getAllByRole("listitem")).toHaveLength(3);
    expect(
      within(keyMoves).getByRole("img", { name: "Brilliant move" }),
    ).toBeInTheDocument();
    expect(
      within(keyMoves).getByRole("img", { name: "Blunder move" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Trust curve" }),
    ).toBeInTheDocument();
  });

  it("offers the full review only on a full certificate", async () => {
    const onViewFullReview = vi.fn();
    const { rerender } = render(
      <CertificateCard
        certificate={certificateLimited}
        onViewFullReview={onViewFullReview}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "View full review" }),
    ).not.toBeInTheDocument();

    rerender(
      <CertificateCard
        certificate={certificateFull}
        onViewFullReview={onViewFullReview}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "View full review" }),
    );
    expect(onViewFullReview).toHaveBeenCalledTimes(1);
  });
});
