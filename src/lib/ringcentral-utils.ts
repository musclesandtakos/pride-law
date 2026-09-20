import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

function encryptionKey() {
  const secret = process.env.RINGCENTRAL_TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error("RingCentral token encryption is not configured.");
  return createHash("sha256").update(secret).digest();
}

export function encryptToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptToken(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Stored RingCentral token is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

export function webhookSecretHash(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function verifyWebhookSecret(secret: string, expectedHash: string | null) {
  if (!expectedHash) return false;
  const actual = Buffer.from(webhookSecretHash(secret));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function normalizePhone(value: string | null | undefined) {
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 ? `1${digits}` : digits;
}
