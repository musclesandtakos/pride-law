import { describe, expect, it } from "vitest";
import {
  humanizeField,
  isDocxFile,
  makeTemplateStoragePath,
  parseTemplateFields,
  sanitizeFileName,
} from "./templates";

describe("template helpers", () => {
  it("normalizes and deduplicates placeholder fields", () => {
    expect(parseTemplateFields("Client Name, matter number\nclient_name")).toEqual([
      "client_name",
      "matter_number",
    ]);
  });

  it("accepts only docx uploads", () => {
    expect(isDocxFile({ name: "Retainer.docx", type: "application/octet-stream" })).toBe(true);
    expect(isDocxFile({ name: "Retainer.doc", type: "application/msword" })).toBe(false);
  });

  it("builds safe storage paths", () => {
    const path = makeTemplateStoragePath("firm-1", "Engagement Letter Final.DOCX", "abc123");
    expect(path).toBe("firm-1/abc123-engagement-letter-final.docx");
    expect(sanitizeFileName("Case #12!.docx")).toBe("case-12-.docx");
  });

  it("humanizes field names", () => {
    expect(humanizeField("client_preferred_name")).toBe("Client Preferred Name");
  });
});
