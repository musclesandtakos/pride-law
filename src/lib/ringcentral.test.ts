import { afterEach, describe, expect, it } from "vitest";
import { decryptToken, encryptToken, normalizePhone, verifyWebhookSecret, webhookSecretHash } from "./ringcentral-utils";

const originalKey = process.env.RINGCENTRAL_TOKEN_ENCRYPTION_KEY;
afterEach(() => { process.env.RINGCENTRAL_TOKEN_ENCRYPTION_KEY = originalKey; });

describe("RingCentral helpers", () => {
  it("normalizes domestic and international phone numbers", () => {
    expect(normalizePhone("(954) 555-1212")).toBe("19545551212");
    expect(normalizePhone("+44 20 7946 0958")).toBe("442079460958");
  });

  it("encrypts and decrypts OAuth tokens", () => {
    process.env.RINGCENTRAL_TOKEN_ENCRYPTION_KEY = "test-only-secret";
    const encrypted = encryptToken("very-sensitive-token");
    expect(encrypted).not.toContain("very-sensitive-token");
    expect(decryptToken(encrypted)).toBe("very-sensitive-token");
  });

  it("compares webhook secrets from hashes", () => {
    expect(verifyWebhookSecret("correct", webhookSecretHash("correct"))).toBe(true);
    expect(verifyWebhookSecret("wrong", webhookSecretHash("correct"))).toBe(false);
  });
});
