import {
  PDFDocument,
  PDFObjectCopier,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFOptionList,
  StandardFonts,
  rgb,
} from "pdf-lib";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { FormField, FormValues, templateReady } from "./client-forms";

export async function inspectTemplate(
  bytes: Uint8Array,
  format: string,
): Promise<FormField[]> {
  if (format === "pdf") {
    const pdf = await PDFDocument.load(bytes);
    return pdf
      .getForm()
      .getFields()
      .flatMap<FormField>((field, index) => {
        const base = {
          key: `field_${index + 1}`,
          label: field.getName().replaceAll("_", " "),
          section: "Form details",
          required: true,
          prefill: "" as const,
          target: field.getName(),
        };
        if (field instanceof PDFCheckBox)
          return [{ ...base, type: "checkbox" as const, options: [] }];
        if (
          field instanceof PDFDropdown ||
          field instanceof PDFRadioGroup ||
          field instanceof PDFOptionList
        )
          return [
            { ...base, type: "select" as const, options: field.getOptions() },
          ];
        if (field instanceof PDFTextField)
          return [
            {
              ...base,
              type: (field.isMultiline() ? "textarea" : "text") as
                | "textarea"
                | "text",
              options: [],
            },
          ];
        return [];
      });
  }
  if (format === "docx") {
    const doc = new Docxtemplater(new PizZip(bytes), {
      delimiters: { start: "{{", end: "}}" },
    });
    const keys = Array.from(
      new Set(
        Array.from(
          doc.getFullText().matchAll(/\{\{([a-z][a-z0-9_]*)\}\}/g),
          (m) => m[1],
        ),
      ),
    );
    return keys.map((key) => ({
      key,
      label: key.replaceAll("_", " "),
      section: "Document details",
      type: "text",
      required: true,
      prefill: "",
      options: [],
      target: key,
    }));
  }
  return [];
}
export async function renderClientForm(
  bytes: Uint8Array,
  format: string,
  fields: FormField[],
  answers: FormValues,
) {
  if (!templateReady(format, fields))
    throw new Error(
      "This template needs field mapping before it can be generated.",
    );
  if (format === "docx") {
    const doc = new Docxtemplater(new PizZip(bytes), {
      delimiters: { start: "{{", end: "}}" },
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => {
        throw new Error("An unmapped document placeholder remains.");
      },
    });
    doc.render(
      Object.fromEntries(
        fields.map((field) => [field.target!, answers[field.key] || ""]),
      ),
    );
    return new Uint8Array(doc.getZip().generate({ type: "nodebuffer" }));
  }
  const original = await PDFDocument.load(bytes);
  // Rebuild reachable references in a fresh context. Older incremental PDFs can reuse
  // an object number across generations, which pdf-lib cannot serialize reliably.
  const normalized = await PDFDocument.create();
  const copier = PDFObjectCopier.for(original.context, normalized.context);
  for (const [key, value] of original.catalog.entries())
    normalized.catalog.set(key, copier.copy(value));
  const pdf = await PDFDocument.load(
    await normalized.save({
      useObjectStreams: false,
      addDefaultPage: false,
      updateFieldAppearances: false,
    }),
  );
  const form = pdf.getForm();
  const nativeFields = form.getFields();
  const mapped = new Set(fields.flatMap((f) => (f.target ? [f.target] : [])));
  if (nativeFields.some((f) => !mapped.has(f.getName())))
    throw new Error("Every native PDF field must be mapped before use.");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const field of fields) {
    const value = answers[field.key] || "";
    if (field.overlay) {
      const { page: pageIndex, x, y, width, height } = field.overlay;
      const page = pdf.getPage(pageIndex);
      if (x + width > page.getWidth() || y + height > page.getHeight())
        throw new Error(`${field.label}: mapped field is outside the page.`);
      if (value) {
        // Wrap at word boundaries; reject overflow instead of silently clipping an answer.
        const lines: string[] = [];
        let line = "";
        const size = 10;
        for (const paragraph of value.split("\n")) {
          for (const word of paragraph.split(/\s+/)) {
            if (font.widthOfTextAtSize(word, size) > width)
              throw new Error(
                `${field.label}: a word is too wide for the mapped field.`,
              );
            const next = line ? `${line} ${word}` : word;
            if (font.widthOfTextAtSize(next, size) > width) {
              lines.push(line);
              line = word;
            } else line = next;
          }
          lines.push(line);
          line = "";
        }
        if (lines.length * 12 > height)
          throw new Error(
            `${field.label}: answer is too long for the mapped field.`,
          );
        lines.forEach((text, i) =>
          page.drawText(text, {
            x,
            y: y + height - 10 - i * 12,
            size,
            font,
            color: rgb(0, 0, 0),
          }),
        );
      }
    } else {
      const target = form.getField(field.target!);
      if (target instanceof PDFTextField) {
        if (!["text", "textarea", "date"].includes(field.type))
          throw new Error(
            `${field.label}: field type does not match the source.`,
          );
        if (!target.isMultiline() && value.includes("\n"))
          throw new Error(
            `${field.label}: this source field accepts one line.`,
          );
        if (target.getMaxLength() && value.length > target.getMaxLength()!)
          throw new Error(
            `${field.label}: answer exceeds the source field limit.`,
          );
        for (const widget of target.acroField.getWidgets()) {
          const rect = widget.getRectangle();
          const availableWidth = rect.width - 4;
          const maxLines = target.isMultiline()
            ? Math.floor((rect.height - 4) / 12)
            : 1;
          let lines = 0;
          for (const paragraph of value.split("\n")) {
            let line = "";
            for (const word of paragraph.split(/\s+/)) {
              if (font.widthOfTextAtSize(word, 10) > availableWidth)
                throw new Error(
                  `${field.label}: a word is too wide for the source field.`,
                );
              const next = line ? `${line} ${word}` : word;
              if (font.widthOfTextAtSize(next, 10) > availableWidth) {
                lines++;
                line = word;
              } else line = next;
            }
            lines++;
          }
          if (value && lines > Math.max(1, maxLines))
            throw new Error(
              `${field.label}: answer is too long for the source field.`,
            );
        }
        target.setText(value);
        target.acroField.setDefaultAppearance(`/${font.name} 10 Tf 0 g`);
      } else if (target instanceof PDFCheckBox) {
        if (field.type !== "checkbox")
          throw new Error(`${field.label}: expected a yes/no field.`);
        if (value === "Yes") target.check();
        else target.uncheck();
      } else if (
        target instanceof PDFDropdown ||
        target instanceof PDFRadioGroup ||
        target instanceof PDFOptionList
      ) {
        if (
          field.type !== "select" ||
          field.options.some((option) => !target.getOptions().includes(option))
        )
          throw new Error(
            `${field.label}: choice mapping does not match the source.`,
          );
        if (value) target.select(value);
        else target.clear();
      } else throw new Error(`${field.label}: unsupported PDF field.`);
    }
  }
  form.updateFieldAppearances(font);
  return pdf.save({ useObjectStreams: false });
}
