import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MoveLabelBadge } from "@/ui/move-label-badge";
import { MOVE_LABEL_META, MOVE_LABEL_ORDER } from "@/ui/move-labels";

describe("MoveLabelBadge", () => {
  it.each(MOVE_LABEL_ORDER)("shows the glyph and an aria-label for %s", (label) => {
    const meta = MOVE_LABEL_META[label];
    render(<MoveLabelBadge label={label} />);

    const badge = screen.getByRole("img", { name: `${meta.name} move` });
    expect(badge).toHaveTextContent(meta.glyph);
    expect(badge).toHaveTextContent(meta.name);
    expect(badge).toHaveAttribute("data-label", label);
  });

  it("gives every label a distinct glyph, so color is never the only signal", () => {
    const glyphs = MOVE_LABEL_ORDER.map((label) => MOVE_LABEL_META[label].glyph);
    expect(new Set(glyphs).size).toBe(MOVE_LABEL_ORDER.length);
  });

  it("keeps the accessible name when only the glyph is visible", () => {
    render(<MoveLabelBadge label="blunder" variant="glyph" />);

    const badge = screen.getByRole("img", { name: "Blunder move" });
    expect(badge).toHaveTextContent("??");
    expect(badge).not.toHaveTextContent("Blunder");
  });
});
