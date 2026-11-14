import { act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { certificateLimited } from "@/app/(design)/design/fixtures";
import { AccuracyStat } from "@/ui/accuracy-stat";
import { CertificateCard } from "@/ui/certificate-card";
import { Reveal } from "@/ui/reveal";

// Model separate server and browser motion preferences in the same jsdom process.
vi.mock("motion/react", async (importOriginal) => ({
  ...await importOriginal<typeof import("motion/react")>(),
  useReducedMotion: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
}));

describe("reduced motion hydration", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;
  afterEach(async () => {
    if (root) await act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    vi.unstubAllGlobals();
  });

  it("hydrates server animation markup before applying reduced motion", async () => {
    let reduce = false;
    const listeners = new Set<() => void>();
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      media: query,
      get matches() { return reduce; },
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    })));
    const view = <><AccuracyStat accuracy={74} animate /><CertificateCard certificate={certificateLimited} /><Reveal>Details</Reveal></>;
    const html = renderToString(view);
    expect(html).toContain("--border-beam-width");
    container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    reduce = true;
    const onRecoverableError = vi.fn();
    await act(() => { root = hydrateRoot(container!, view, { onRecoverableError }); });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.querySelector('[aria-hidden="true"].font-mono')).toHaveTextContent("74%");
    expect(container.querySelector('[style*="--border-beam-width"]')).toBeNull();

    await act(() => {
      reduce = false;
      listeners.forEach((listener) => listener());
    });
    expect(container.querySelector('[style*="--border-beam-width"]')).not.toBeNull();
  });
});
