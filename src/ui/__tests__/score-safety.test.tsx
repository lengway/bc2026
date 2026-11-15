import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { AccuracyStat } from "../accuracy-stat";
import { CertificateCard } from "../certificate-card";
import { certificateLimited } from "@/app/(design)/design/fixtures";

it("keeps an unknown score distinct from zero", () => {
  render(<AccuracyStat accuracy={null} />);
  expect(screen.getByText("Not enough evidence")).toBeInTheDocument();
  expect(screen.queryByText("0%")).not.toBeInTheDocument();
});
it("renders a static Accuracy percentage exactly once", () => {
  render(<AccuracyStat accuracy={67} />);
  expect(screen.getAllByText("67%")).toHaveLength(1);
  expect(screen.getByText("67%")).not.toHaveAttribute("aria-hidden", "true");
});
it("describes a certificate as a recorded simulation, without an identity claim", () => {
  render(<CertificateCard certificate={certificateLimited} />);
  expect(screen.getByText("Recorded simulation")).toBeInTheDocument();
  expect(screen.queryByText("Verified")).not.toBeInTheDocument();
  expect(
    screen.queryByText(/Every move was written by the holder/),
  ).not.toBeInTheDocument();
});

it("keeps the guest demo designation visible on public certificates", () => {
  render(<CertificateCard certificate={{ ...certificateLimited, isDemo: true }} />);
  expect(screen.getByText("Demo")).toBeInTheDocument();
});
