import { render, screen, within } from "@testing-library/react";
import { CertificateFull } from "@/contracts";
import backendCertificate from "@/mocks/fixtures/certificate-full.json";
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
    expect(screen.getByText("7F3K-2291X")).toBeInTheDocument();
    expect(screen.getByText("Verified simulation record")).toBeInTheDocument();

    expect(screen.queryByRole("region", { name: "Key moves" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Trust curve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /move$/ })).not.toBeInTheDocument();
  });

  it("adds the three key moves and the trust curve to a full certificate", () => {
    render(<CertificateCard certificate={certificateFull} />);

    const keyMoves = screen.getByRole("region", { name: "Key moves" });
    expect(within(keyMoves).getAllByRole("listitem")).toHaveLength(3);
    expect(within(keyMoves).getByRole("img", { name: "Brilliant move" })).toBeInTheDocument();
    expect(within(keyMoves).getByRole("img", { name: "Blunder move" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Trust curve" })).toBeInTheDocument();
  });

  it("offers the full review only on a full certificate", async () => {
    const onViewFullReview = vi.fn();
    const { rerender } = render(
      <CertificateCard certificate={certificateLimited} onViewFullReview={onViewFullReview} />,
    );
    expect(screen.queryByRole("button", { name: "View full review" })).not.toBeInTheDocument();

    rerender(
      <CertificateCard certificate={certificateFull} onViewFullReview={onViewFullReview} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "View full review" }));
    expect(onViewFullReview).toHaveBeenCalledTimes(1);
  });
});

it("accepts a public full certificate without private process observations", () => {
  const certificate = CertificateFull.parse(backendCertificate);
  expect(certificate.evaluation).not.toHaveProperty("processObservations");
  render(<CertificateCard certificate={certificate} />);
  expect(screen.getByText(certificate.holderName)).toBeInTheDocument();
});

it("labels a demo with assistance as a verified simulation record without claiming authorship", () => {
  const certificate = CertificateFull.parse({ ...backendCertificate, isDemo: true });
  expect(certificate.assistance.copilotRequests).toBeGreaterThan(0);
  render(<CertificateCard certificate={certificate} />);
  expect(screen.getByText("Demo")).toBeInTheDocument();
  expect(screen.getByText("Verified simulation record")).toBeInTheDocument();
  expect(screen.getByText(/verification covers the recorded simulation/i)).toBeInTheDocument();
  expect(screen.queryByText(/every move was written by the holder/i)).not.toBeInTheDocument();
});

it("describes verification scope for a non-demo record", () => {
  const certificate = CertificateFull.parse({ ...backendCertificate, isDemo: false });
  render(<CertificateCard certificate={certificate} verifyUrl="https://example.test/verify" />);
  expect(screen.queryByText("Demo")).not.toBeInTheDocument();
  expect(screen.getByText(/verification covers the recorded simulation/i)).toBeInTheDocument();
  expect(screen.queryByText(/every move was written by the holder/i)).not.toBeInTheDocument();
});

it("shows unavailable certificate accuracy without a zero score", () => {
  render(<CertificateCard certificate={{ ...certificateLimited, accuracy: null }} />);
  expect(screen.getByText("Unavailable")).toBeInTheDocument();
  expect(screen.queryByText("0%")).not.toBeInTheDocument();
});
