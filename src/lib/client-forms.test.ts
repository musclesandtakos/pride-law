import { describe, it, expect } from "vitest";
import {
  formFieldsSchema,
  formFieldSchema,
  prefillAnswers,
  validateAnswers,
  templateReady,
} from "./client-forms";
const field = (key: string) =>
  formFieldSchema.parse({ key, label: key, target: key });
describe("client form completion", () => {
  it("prefills verified client/intake values and leaves execution names unanswered", () => {
    const fields = [
      { ...field("name"), prefill: "client_name" as const },
      { ...field("dob"), prefill: "date_of_birth" as const },
      field("witness_name"),
      field("signature"),
    ];
    expect(
      prefillAnswers(
        fields,
        { name: "Jordan" },
        { legal_name: "Jordan Rivera", date_of_birth: "1990-01-02" },
        null,
      ),
    ).toEqual({
      name: "Jordan Rivera",
      dob: "1990-01-02",
      witness_name: "",
      signature: "",
    });
  });
  it("allows incomplete drafts and rejects incomplete finalization", () => {
    expect(validateAnswers([field("name")], {}, false)).toEqual([]);
    expect(validateAnswers([field("name")], {}, true)).toHaveLength(1);
    expect(
      validateAnswers(
        [field("name")],
        { name: "Jordan", unexpected: "data" },
        true,
      ),
    ).toContain("Unrecognized form field.");
  });
  it("checks choices, calendar dates and explicit no answers", () => {
    const fields = [
      { ...field("date"), type: "date" as const },
      { ...field("consent"), type: "checkbox" as const },
    ];
    expect(
      validateAnswers(fields, { date: "2026-02-30", consent: "true" }, true),
    ).toHaveLength(2);
    expect(
      validateAnswers(fields, { date: "2026-02-28", consent: "No" }, true),
    ).toEqual([]);
  });
  it("rejects duplicate keys and payment card collection fields", () => {
    expect(
      formFieldsSchema.safeParse([field("name"), field("name")]).success,
    ).toBe(false);
    expect(
      formFieldsSchema.safeParse([{ ...field("security"), label: "CVV" }])
        .success,
    ).toBe(false);
  });
  it("requires supported and mapped templates", () => {
    expect(templateReady("doc", [field("name")])).toBe(false);
    expect(
      templateReady("pdf", [
        formFieldSchema.parse({ key: "name", label: "Name" }),
      ]),
    ).toBe(false);
    expect(templateReady("pdf", [field("name")])).toBe(true);
  });
});
