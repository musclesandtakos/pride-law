import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it("keeps safe internal paths", () => {
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
  });

  it("falls back to root for missing or unsafe paths", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("https://example.com")).toBe("/");
    expect(safeNextPath("//evil.test")).toBe("/");
  });
});
