import { afterEach, expect, it, vi } from "vitest";
import { CheckoutRequest } from "@/contracts";
import { api } from "./api";
import { recordDocumentOpen } from "./integration-api";

afterEach(() => vi.unstubAllGlobals());

it("sends the selected checkout period using the backend request contract", async () => {
  let payload: unknown;
  vi.stubGlobal("fetch", async (_url: unknown, init: RequestInit) => {
    payload = JSON.parse(String(init.body));
    return Response.json({ url: "https://checkout.stripe.com/c/pay/test" });
  });
  await api.checkout("yearly");
  expect(CheckoutRequest.parse(payload)).toEqual({ plan: "yearly" });
});

it("reports unsupported document observations without calling an absent route", async () => {
  const fetch = vi.fn(async () => Response.json({ accepted: true }));
  vi.stubGlobal("fetch", fetch);
  await expect(
    recordDocumentOpen(crypto.randomUUID(), "brief"),
  ).rejects.toMatchObject({
    code: "UNSUPPORTED",
  });
  expect(fetch).not.toHaveBeenCalled();
});
