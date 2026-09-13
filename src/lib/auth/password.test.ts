import { describe, expect, it } from "vitest";
import { validateNewPassword } from "./password";

describe("validateNewPassword", () => {
  it("requires at least eight characters", () => {
    expect(validateNewPassword("short", "short")).toBe("Password must be at least 8 characters.");
  });

  it("requires matching values", () => {
    expect(validateNewPassword("long-enough", "different-value")).toBe("Passwords do not match.");
  });

  it("accepts a matching valid password", () => {
    expect(validateNewPassword("long-enough", "long-enough")).toBeNull();
  });
});
