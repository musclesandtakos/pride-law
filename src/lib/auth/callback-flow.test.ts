import { describe, expect, it } from "vitest";
import { parseEmailOtpType, resolveCallbackFlow } from "./callback-flow";

describe("parseEmailOtpType", () => {
  it("accepts only known OTP types", () => {
    expect(parseEmailOtpType("invite")).toBe("invite");
    expect(parseEmailOtpType("recovery")).toBe("recovery");
    expect(parseEmailOtpType("signup")).toBe("signup");
    expect(parseEmailOtpType("unknown")).toBeNull();
    expect(parseEmailOtpType(null)).toBeNull();
  });
});

describe("resolveCallbackFlow", () => {
  it("distinguishes invite, recovery, and other flows", () => {
    expect(resolveCallbackFlow({ flow: "invite", type: null })).toBe("invite");
    expect(resolveCallbackFlow({ flow: null, type: "invite" })).toBe("invite");
    expect(resolveCallbackFlow({ flow: "recovery", type: null })).toBe("recovery");
    expect(resolveCallbackFlow({ flow: null, type: "recovery" })).toBe("recovery");
    expect(resolveCallbackFlow({ flow: null, type: "signup" })).toBe("other");
  });
});
