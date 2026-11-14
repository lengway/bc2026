import { setupWorker } from "msw/browser";
import { HttpNetworkFrame } from "msw/experimental";
import { createMockHandlers } from "./handlers";
export const worker = setupWorker(
  ...createMockHandlers({
    persist: true,
    browserOrigin: window.location.origin,
  }),
);
let started: Promise<unknown> | undefined;
export function startMocks() {
  started ??= worker
    .start({
      onUnhandledFrame({ frame, defaults }) {
        if (
          frame instanceof HttpNetworkFrame &&
          new URL(frame.data.request.url).pathname.startsWith("/api/")
        )
          defaults.error();
      },
      quiet: true,
    })
    .catch((error) => {
      started = undefined;
      throw error;
    });
  return started;
}
