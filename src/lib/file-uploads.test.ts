import { describe, expect, it } from "vitest";
import { staffStoragePath, validateCaseFile } from "./file-uploads";

describe("case file uploads", () => {
  it("accepts supported photos and documents", () => {
    expect(validateCaseFile(new File(["photo"], "evidence.jpg", { type: "image/jpeg" }))).toBeNull();
    expect(validateCaseFile(new File(["pdf"], "records.pdf", { type: "application/pdf" }))).toBeNull();
  });

  it("rejects unsupported and oversized files", () => {
    expect(validateCaseFile(new File(["x"], "script.html", { type: "text/html" }))).toContain("not a supported");
    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf", { type: "application/pdf" });
    expect(validateCaseFile(oversized)).toContain("smaller than 10 MB");
  });

  it("does not expose the original staff filename in storage paths", () => {
    const path = staffStoragePath("firm-id", new File(["x"], "Private Client Name.PDF", { type: "application/pdf" }));
    expect(path).toMatch(/^firm-id\/staff\/[0-9a-f-]+\.pdf$/);
    expect(path).not.toContain("Private");
  });
});
