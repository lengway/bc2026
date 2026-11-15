import {
  unstable_doesMiddlewareMatch,
  unstable_getResponseFromNextConfig,
} from "next/experimental/testing/server";
import { expect, it, vi } from "vitest";
import { config } from "@/proxy";
import nextConfig from "../../../next.config";

vi.mock("@/modules/runtime", () => ({ getRuntime: vi.fn() }));
vi.mock("@/modules/identity", () => ({
  readSessionCookie: vi.fn(),
  sessionCookie: vi.fn(),
}));

it("makes Help public while leaving Dashboard behind the sign-in proxy", () => {
  expect(unstable_doesMiddlewareMatch({ config, url: "/help" })).toBe(false);
  expect(unstable_doesMiddlewareMatch({ config, url: "/dashboard" })).toBe(
    true,
  );
});

it("does not send a noindex header for Help", async () => {
  const response = await unstable_getResponseFromNextConfig({
    nextConfig,
    url: "https://gambit.lengway.me/help",
  });

  expect(response.headers.get("x-robots-tag")).toBeNull();
});
