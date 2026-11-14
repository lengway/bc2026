export function safeNextPath(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f]/u.test(value) ||
    /%2f|%5c/i.test(value)
  )
    return "/dashboard";
  const url = new URL(value, "https://app.invalid");
  if (
    url.origin !== "https://app.invalid" ||
    !/^\/(dashboard|onboarding|case|review|path|history|certificates|settings|billing|help)(\/|$)/.test(
      url.pathname,
    )
  )
    return "/dashboard";
  return url.pathname + url.search + url.hash;
}
