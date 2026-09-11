const LOCAL_FALLBACK_ORIGIN = "http://localhost:3000";

function parseAppUrl(value: string): string | null {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password) {
    return null;
  }

  return parsed.origin;
}

export function getAppUrlOrigin(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.NEXT_PUBLIC_APP_URL;
  const parsed = configured ? parseAppUrl(configured) : null;
  const production = env.NODE_ENV === "production";

  if (parsed) return parsed;

  if (!production) return LOCAL_FALLBACK_ORIGIN;

  const detail = configured
    ? `received ${JSON.stringify(configured)}`
    : "received an empty value";

  throw new Error(
    `Invalid NEXT_PUBLIC_APP_URL configuration: expected an http(s) origin without credentials; ${detail}.`,
  );
}
