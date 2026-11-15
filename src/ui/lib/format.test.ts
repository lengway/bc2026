import { expect, it } from "vitest";
import { firstName } from "./format";

it.each([
  ["Dr. Morgan Lee", "Morgan"],
  ["  DR Morgan Lee  ", "Morgan"],
  ["Ms. Dana Whitfield", "Dana"],
  ["Dana Whitfield", "Dana"],
  ["Dana", "Dana"],
  ["Dr.", "Dr."],
  ["   ", ""],
])("formats the given name in %j as %j", (name, expected) => {
  expect(firstName(name)).toBe(expected);
});
