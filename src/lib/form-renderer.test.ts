import { describe, it, expect } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";
import PizZip from "pizzip";
import { inspectTemplate, renderClientForm } from "./form-renderer";
import { formFieldSchema } from "./client-forms";
function word() {
  const z = new PizZip();
  z.file(
    "[Content_Types].xml",
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  z.file(
    "_rels/.rels",
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  z.file(
    "word/document.xml",
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Client: {{client_</w:t></w:r><w:r><w:t>name}}</w:t></w:r></w:p></w:body></w:document>',
  );
  return z.generate({ type: "uint8array" });
}
describe("original template rendering", () => {
  it("normalizes PDFs containing multiple generations of the same object number", async () => {
    const objects = [
      [1, 0, "<< /Type /Catalog /Pages 2 0 R /AcroForm 4 0 R >>"],
      [1, 1, "<< /Type /Catalog /Pages 2 0 R /AcroForm 4 0 R >>"],
      [2, 0, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"],
      [
        3,
        0,
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <<>> /Annots [5 0 R] >>",
      ],
      [4, 0, "<< /Fields [5 0 R] >>"],
      [
        5,
        0,
        "<< /Type /Annot /Subtype /Widget /FT /Tx /T (name) /Rect [50 700 350 730] /P 3 0 R >>",
      ],
    ] as const;
    let source = "%PDF-1.7\n";
    const offsets = new Map<number, [number, number]>();
    for (const [id, generation, body] of objects) {
      offsets.set(id, [source.length, generation]);
      source += `${id} ${generation} obj\n${body}\nendobj\n`;
    }
    const xref = source.length;
    source += "xref\n0 6\n0000000000 65535 f \n";
    for (let id = 1; id <= 5; id++) {
      const [offset, generation] = offsets.get(id)!;
      source += `${String(offset).padStart(10, "0")} ${String(generation).padStart(5, "0")} n \n`;
    }
    source += `trailer\n<< /Size 6 /Root 1 1 R >>\nstartxref\n${xref}\n%%EOF`;
    const bytes = new TextEncoder().encode(source);
    const fields = await inspectTemplate(bytes, "pdf");
    const output = await renderClientForm(bytes, "pdf", fields, {
      field_1: "Jordan Rivera",
    });
    const doc = await PDFDocument.load(output);
    expect(doc.getForm().getTextField("name").getText()).toBe("Jordan Rivera");
    expect(
      doc.context
        .enumerateIndirectObjects()
        .every(([ref]) => ref.generationNumber === 0),
    ).toBe(true);
    expect(doc.catalog.get(PDFName.of("Pages"))).toBeDefined();
  });

  it("fills canonical PDF fields, persists appearances, and preserves original bytes", async () => {
    const source = await PDFDocument.create();
    const page = source.addPage();
    const form = source.getForm();
    const text = form.createTextField("client_name");
    text.addToPage(page, { x: 50, y: 700, width: 300, height: 30 });
    const check = form.createCheckBox("permission");
    check.addToPage(page, { x: 50, y: 600, width: 20, height: 20 });
    const bytes = await source.save();
    const fields = await inspectTemplate(bytes, "pdf");
    const answers = Object.fromEntries(
      fields.map((f) => [
        f.key,
        f.type === "checkbox" ? "No" : "Jordan Rivera",
      ]),
    );
    const rendered = await PDFDocument.load(
      await renderClientForm(bytes, "pdf", fields, answers),
    );
    expect(rendered.getForm().getTextField("client_name").getText()).toBe(
      "Jordan Rivera",
    );
    expect(rendered.getForm().getCheckBox("permission").isChecked()).toBe(
      false,
    );
    expect(
      rendered
        .getForm()
        .getTextField("client_name")
        .acroField.getWidgets()[0]
        .getAppearances()?.normal,
    ).toBeDefined();
    expect(
      (await PDFDocument.load(bytes))
        .getForm()
        .getTextField("client_name")
        .getText(),
    ).toBeUndefined();
  });
  it("substitutes Word placeholders split across runs and escapes XML", async () => {
    const bytes = word();
    const fields = await inspectTemplate(bytes, "docx");
    expect(fields[0].target).toBe("client_name");
    const output = await renderClientForm(bytes, "docx", fields, {
      client_name: "Jordan & Alex <Rivera>",
    });
    expect(new PizZip(output).file("word/document.xml")!.asText()).toContain(
      "Jordan &amp; Alex &lt;Rivera&gt;",
    );
    expect(new PizZip(bytes).file("word/document.xml")!.asText()).toContain(
      "{{client_",
    );
  });
  it("rejects unmapped Word tags and PDF overlay overflow", async () => {
    await expect(
      renderClientForm(
        word(),
        "docx",
        [
          formFieldSchema.parse({
            key: "other",
            label: "Other",
            target: "other",
          }),
        ],
        { other: "A" },
      ),
    ).rejects.toThrow("unmapped");
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const field = formFieldSchema.parse({
      key: "note",
      label: "Note",
      overlay: { page: 0, x: 20, y: 20, width: 50, height: 12 },
    });
    await expect(
      renderClientForm(await pdf.save(), "pdf", [field], {
        note: "This answer cannot fit in the box",
      }),
    ).rejects.toThrow("too long");
  });
});
