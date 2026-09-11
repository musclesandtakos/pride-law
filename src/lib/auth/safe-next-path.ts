const SAFE_BASE_URL = new URL("https://internal.local");
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;

export function safeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  if (CONTROL_CHAR_PATTERN.test(next) || next.includes("\\") || /%5c/i.test(next)) return "/";

  try {
    decodeURI(next);
  } catch {
    return "/";
  }

  let parsed: URL;

  try {
    parsed = new URL(next, SAFE_BASE_URL);
  } catch {
    return "/";
  }

  if (parsed.origin !== SAFE_BASE_URL.origin) return "/";

  const safePath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  if (!safePath.startsWith("/") || safePath.startsWith("//") || safePath.includes("\\")) return "/";

  return safePath;
}
