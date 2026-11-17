import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { mergePdfs } from "./pdf";
import { clampCopies, initialCopies, printJob, totalCopies } from "./print";
import type { Part } from "./types";

const parts: Part[] = [
  { id: "clarinete-sib-1", name: "Clarinete Sib 1", index: 0 },
  { id: "trompete-sib-1", name: "Trompete Sib 1", index: 1 },
  { id: "tuba-mib-1", name: "Tuba Mib 1", index: 2 },
];

async function pdfWith(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([595, 842]);
  return doc.save();
}

describe("impressão das partes", () => {
  it("cópias começam em 1 ou no que foi usado antes", () => {
    expect(initialCopies(parts, {})).toEqual({ "clarinete-sib-1": 1, "trompete-sib-1": 1, "tuba-mib-1": 1 });
    expect(initialCopies(parts, { "trompete-sib-1": 4, "tuba-mib-1": 0, outra: 9 })).toEqual({
      "clarinete-sib-1": 1,
      "trompete-sib-1": 4,
      "tuba-mib-1": 1,
    });
  });

  it("limita as cópias entre 0 e 99", () => {
    expect(clampCopies(3.7)).toBe(3);
    expect(clampCopies(-2)).toBe(0);
    expect(clampCopies(500)).toBe(99);
    expect(clampCopies(NaN)).toBe(0);
  });

  it("lista só as partes marcadas com cópias, na ordem da grade", () => {
    const sel = new Set(["tuba-mib-1", "clarinete-sib-1", "trompete-sib-1"]);
    const job = printJob(parts, sel, { "clarinete-sib-1": 2, "trompete-sib-1": 0, "tuba-mib-1": 3 });
    expect(job).toEqual([
      { id: "clarinete-sib-1", copies: 2 },
      { id: "tuba-mib-1", copies: 3 },
    ]);
    expect(totalCopies(job)).toBe(5);
    expect(printJob(parts, new Set(["tuba-mib-1"]), { "tuba-mib-1": 1 })).toEqual([
      { id: "tuba-mib-1", copies: 1 },
    ]);
  });

  it("junta os PDFs com as cópias de cada parte em sequência", async () => {
    const cl = await pdfWith(2);
    const tb = await pdfWith(1);
    const out = await PDFDocument.load(
      await mergePdfs([
        { bytes: cl, copies: 3 },
        { bytes: tb, copies: 2 },
      ]),
    );
    expect(out.getPageCount()).toBe(8);
  });
});
