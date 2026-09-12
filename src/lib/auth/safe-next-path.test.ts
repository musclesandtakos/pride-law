import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it("keeps safe internal paths with query and hash", () => {
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
    expect(safeNextPath("/templates?category=Forms#library")).toBe("/templates?category=Forms#library");
  });

  it("falls back to root for missing or unsafe paths", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("https://example.com")).toBe("/");
    expect(safeNextPath("//evil.test")).toBe("/");
    expect(safeNextPath("/%5Cevil.test")).toBe("/");
    expect(safeNextPath("/%5cevil.test")).toBe("/");
    expect(safeNextPath("/\\evil.test")).toBe("/");
    expect(safeNextPath("/safe\npath")).toBe("/");
    expect(safeNextPath("/%E0%A4%A")).toBe("/");
  });
});
