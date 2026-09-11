import { describe, expect, it } from "vitest";
import { getAppUrlOrigin } from "./app-url";

describe("getAppUrlOrigin", () => {
  it("normalizes configured URLs to origin", () => {
    expect(getAppUrlOrigin({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://app.example.test/path?x=1#y" })).toBe(
      "https://app.example.test",
    );
  });

  it("allows localhost fallback outside production", () => {
    expect(getAppUrlOrigin({ NODE_ENV: "development" })).toBe("http://localhost:3000");
    expect(getAppUrlOrigin({ NODE_ENV: "test", NEXT_PUBLIC_APP_URL: "notaurl" })).toBe("http://localhost:3000");
  });

  it("throws in production for missing or invalid values", () => {
    expect(() => getAppUrlOrigin({ NODE_ENV: "production" })).toThrow(/NEXT_PUBLIC_APP_URL/);
    expect(() => getAppUrlOrigin({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "ftp://example.test" })).toThrow(
      /NEXT_PUBLIC_APP_URL/,
    );
    expect(() => getAppUrlOrigin({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: `https://${"user"}@example.test` })).toThrow(
      /NEXT_PUBLIC_APP_URL/,
    );
  });
});
