import { describe, expect, it } from "vitest";
import { parseNote, pitchName } from "./notes";
import {
  chromaticNotes,
  chromaticPitches,
  keySignature,
  makeScale,
  placeScale,
  scaleNotes,
  upAndDown,
} from "./scales";
import { LESSONS, lessonById } from "./lessons";

const ids = (tonic: string, mode: "major" | "minor") => scaleNotes(tonic, mode).map((n) => n.id);

describe("notas escritas", () => {
  it("passo na pauta igual ao do jogo (0 = Mi4)", () => {
    expect(parseNote("E4").step).toBe(0);
    expect(parseNote("C4").step).toBe(-2);
    expect(parseNote("F5").step).toBe(8);
    expect(parseNote("Bb4")).toMatchObject({ name: "Si♭", midi: 70, acc: -1 });
  });
  it("nome do som com bemóis (menos o Fá♯)", () => {
    expect(pitchName(70 - 2)).toBe("Lá♭4");
    expect(pitchName(66)).toBe("Fá♯4");
    expect(pitchName(60)).toBe("Dó4");
  });
});

describe("escalas", () => {
  it("maiores soletradas pela letra", () => {
    expect(ids("C4", "major")).toEqual(["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]);
    expect(ids("F4", "major")).toEqual(["F4", "G4", "A4", "Bb4", "C5", "D5", "E5", "F5"]);
    expect(ids("G4", "major")).toEqual(["G4", "A4", "B4", "C5", "D5", "E5", "F#5", "G5"]);
  });
  it("menores naturais", () => {
    expect(ids("A4", "minor")).toEqual(["A4", "B4", "C5", "D5", "E5", "F5", "G5", "A5"]);
    expect(ids("D4", "minor")).toEqual(["D4", "E4", "F4", "G4", "A4", "Bb4", "C5", "D5"]);
    expect(ids("E4", "minor")).toEqual(["E4", "F#4", "G4", "A4", "B4", "C5", "D5", "E5"]);
  });
  it("armadura na pauta de sol", () => {
    expect(keySignature("C", "major")).toEqual({ acc: 0, steps: [] });
    expect(keySignature("F", "major")).toEqual({ acc: -1, steps: [4] }); // Si4: 3ª linha
    expect(keySignature("G", "major")).toEqual({ acc: 1, steps: [8] }); // Fá5: 5ª linha
    expect(keySignature("D", "minor")).toEqual(keySignature("F", "major"));
    expect(keySignature("E", "minor")).toEqual(keySignature("G", "major"));
    expect(keySignature("Bb", "major").steps).toEqual([4, 7]);
  });
  it("as notas alteradas são as da armadura", () => {
    for (const lesson of LESSONS)
      for (const s of lesson.kind === "scales" ? lesson.scales : []) {
        const altered = s.notes.filter((n) => n.acc !== 0);
        for (const n of altered) expect(n.acc).toBe(s.signature.acc);
        expect(new Set(altered.map((n) => n.letter)).size).toBe(s.signature.steps.length);
      }
  });
  it("nome e endereço", () => {
    expect(makeScale("F4", "major")).toMatchObject({ id: "fa-maior", label: "Fá maior" });
    expect(makeScale("D4", "minor")).toMatchObject({ id: "re-menor", label: "Ré menor" });
  });
  it("menores com bemóis e sustenidos sem acidente duplo", () => {
    expect(ids("F4", "minor")).toEqual(["F4", "G4", "Ab4", "Bb4", "C5", "Db5", "Eb5", "F5"]);
    expect(ids("B4", "major")).toEqual(["B4", "C#5", "D#5", "E5", "F#5", "G#5", "A#5", "B5"]);
    expect(keySignature("B", "major").steps).toHaveLength(5);
    expect(keySignature("F", "minor").steps).toHaveLength(4);
  });
  it("a escala vai para a oitava que cabe no instrumento", () => {
    const a = makeScale("A4", "major");
    expect(placeScale(a, 54, 84)).toBe(a); // cabe na 4ª oitava: a mesma
    expect(placeScale(a, 54, 79)!.notes.map((n) => n.id)[0]).toBe("A3"); // tuba: uma abaixo
    expect(placeScale(a, 54, 79)!.id).toBe(a.id);
    expect(placeScale(a, 70, 75)).toBeNull();
  });
  it("cromática com sustenidos, de semitom em semitom", () => {
    expect(chromaticNotes(60, 64).map((n) => n.id)).toEqual(["C4", "C#4", "D4", "D#4", "E4"]);
  });
  it("cromática: as alteradas com sustenido e bemol (Lá♯ / Si♭), na mesma oitava", () => {
    const p = chromaticPitches(69, 72);
    expect(p.map((x) => x.spellings.map((n) => n.id))).toEqual([["A4"], ["A#4", "Bb4"], ["B4"], ["C5"]]);
    expect(chromaticPitches(61, 61)[0]!.spellings.map((n) => n.name)).toEqual(["Dó♯", "Ré♭"]);
    for (const x of chromaticPitches(52, 89)) for (const n of x.spellings) expect(n.midi).toBe(x.midi);
  });
  it("o exercício sobe e desce sem repetir a nota de cima", () => {
    expect(upAndDown([1, 2, 3])).toEqual([1, 2, 3, 2, 1]);
  });
});

describe("lições", () => {
  it("maiores e menores, com endereços únicos", () => {
    expect(LESSONS.map((l) => l.id)).toEqual(["escalas-maiores", "escalas-menores", "escala-cromatica"]);
    const minor = lessonById("escalas-menores");
    expect(minor?.kind === "scales" && minor.scales.map((s) => s.label)).toEqual([
      "Dó menor",
      "Ré menor",
      "Mi menor",
      "Fá menor",
      "Sol menor",
      "Lá menor",
      "Si menor",
    ]);
    for (const l of LESSONS)
      if (l.kind === "scales") {
        expect(l.scales).toHaveLength(7);
        expect(new Set(l.scales.map((s) => s.id)).size).toBe(7);
      }
  });
});
