import { describe, expect, it } from "vitest";
import { PART_SCALE, clampZoom, layoutFor, scaleFor, stripAbbreviations } from "./sizing";

describe("tamanho da partitura", () => {
  it("escala por largura e zoom", () => {
    expect(scaleFor(390, PART_SCALE)).toBe(31);
    expect(scaleFor(600, PART_SCALE)).toBe(34);
    expect(scaleFor(1200, PART_SCALE)).toBe(42);
    expect(scaleFor(390, PART_SCALE, 1.5)).toBe(47);
  });
  it("zoom limitado e em passos de 10%", () => {
    expect(clampZoom(0.2)).toBe(0.6);
    expect(clampZoom(3)).toBe(1.8);
    expect(clampZoom(1.1000000001)).toBe(1.1);
  });
  it("celular aperta o espaçamento", () => {
    expect(layoutFor(390).spacingLinear).toBeLessThan(0.25);
    expect(layoutFor(1200)).toEqual({});
  });
  it("remove a abreviação e mantém o nome", () => {
    const xml = "<part-name>Trompete Sib 1</part-name><part-abbreviation>Tpt. 1</part-abbreviation>";
    expect(stripAbbreviations(xml)).toBe("<part-name>Trompete Sib 1</part-name>");
  });
});
