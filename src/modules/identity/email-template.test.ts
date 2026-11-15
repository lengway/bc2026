import { describe, expect, it } from "vitest";
import { renderIdentityEmail } from "./email-template";

describe("identity email", () => {
  it.each([
    ["magic_link", "Sign in to Gambit", "15 minutes"],
    ["verify_email", "Confirm your email", "24 hours"],
    ["change_email", "Confirm your new email", "24 hours"],
    ["reset_password", "Reset your password", "30 minutes"],
  ] as const)("renders the action and expiry for %s", (purpose, title, expiry) => {
    const url = "https://example.test/confirm?token=example&next=home";
    const { html, text } = renderIdentityEmail(purpose, url);

    expect(html).toContain(`>${title}</span>`);
    expect(html).toContain(`>${expiry}</strong>`);
    expect(html.match(/href="https:\/\/example\.test\/confirm\?token=example&amp;next=home"/g)).toHaveLength(2);
    expect(text).toContain(url);
    expect(text).toContain(`expires in ${expiry}`);
    expect(html.match(/font-family:/g)).toHaveLength(1);
  });

  it("omits action details when no link is issued", () => {
    const { html, text } = renderIdentityEmail("verify_email", null);

    expect(html).toContain("Gambit account request");
    expect(text).toContain("Gambit account request");
    expect(html).not.toContain("href=");
    expect(text).not.toContain("expires");
  });
});
