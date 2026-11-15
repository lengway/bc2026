import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Choice } from "./intake-fields";

it("names the role radio independently of its description", () => {
  const onChange = vi.fn();
  render(
    <Choice
      name="role"
      checked={false}
      onChange={onChange}
      label="Account executive"
      detail="Discovery to signed deal"
    />,
  );

  const role = screen.getByRole("radio", { name: "Account executive" });
  expect(role).toHaveAccessibleDescription("Discovery to signed deal");
  fireEvent.click(screen.getByText("Discovery to signed deal"));
  expect(onChange).toHaveBeenCalledOnce();
});
