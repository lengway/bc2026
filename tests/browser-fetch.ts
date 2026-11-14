/** Node fetch lacks the Origin header that browsers automatically attach to POST. */
export function simulateBrowserOrigin() {
  const original = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const request = new Request(input, init);
    if (
      !["GET", "HEAD"].includes(request.method) &&
      !request.headers.has("Origin")
    )
      request.headers.set("Origin", window.location.origin);
    return original(request);
  };
  return () => {
    globalThis.fetch = original;
  };
}
