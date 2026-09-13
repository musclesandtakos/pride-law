import { describe, expect, it } from "vitest";
import { callbackDestination, parseEmailOtpType, resolveCallbackFlow } from "./callback-flow";

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

describe("callbackDestination", () => {
  it("keeps invitation and recovery destinations separate", () => {
    expect(callbackDestination("invite", "/templates")).toBe("/onboarding");
    expect(callbackDestination("recovery", "/templates")).toBe("/reset-password");
  });

  it("uses only safe internal destinations for other callbacks", () => {
    expect(callbackDestination("other", "/templates?category=Forms")).toBe("/templates?category=Forms");
    expect(callbackDestination("other", "https://evil.test")).toBe("/");
  });
});
