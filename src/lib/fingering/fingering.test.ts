import { describe, expect, it } from "vitest";
import { LESSONS } from "../studies/lessons";
import { parseNote } from "../studies/notes";
import { chromaticNotes, placeScale } from "../studies/scales";
import { changes, describe as say } from "./describe";
import { rangeOf, STUDY_INSTRUMENTS, studyInstrumentForPart } from "./instruments";
import { CLARINET, fingeringFor, KEYS, RECORDER, SAX, slidePosition } from "./tables";

const keysOf = (f: ReturnType<typeof fingeringFor>) => (f?.kind === "keys" ? f.keys : null);

describe("tabelas de digitação", () => {
  it("toda nota da extensão de todo instrumento tem digitação (é a escala cromática)", () => {
    for (const inst of STUDY_INSTRUMENTS) {
      const [low, high] = rangeOf(inst);
      for (const n of chromaticNotes(low, high))
        expect(fingeringFor(inst.mechanism, n.id), `${inst.name} ${n.id}`).not.toBeNull();
    }
  });
  it("toda escala das lições cabe em todo instrumento", () => {
    for (const inst of STUDY_INSTRUMENTS)
      for (const lesson of LESSONS)
        if (lesson.kind === "scales")
          for (const s of lesson.scales)
            expect(placeScale(s, ...rangeOf(inst)), `${inst.name} ${s.label}`).not.toBeNull();
  });
  it("as tabelas só usam chaves que o diagrama desenha", () => {
    const check = (table: Map<number, string[]>, keys: readonly string[]) => {
      for (const [midi, ks] of table) for (const k of ks) expect(keys, `${midi}: ${k}`).toContain(k);
    };
    check(SAX, KEYS.sax);
    check(CLARINET, KEYS.clarinet);
    check(RECORDER, KEYS.recorder);
  });
  it("sustenido e bemol da mesma altura dão a mesma digitação", () => {
    expect(fingeringFor("sax", "Bb4")).toEqual(fingeringFor("sax", "A#4"));
    expect(fingeringFor("clarinet", "Eb4")).toEqual(fingeringFor("clarinet", "D#4"));
  });
  it("a vara sai dos pistões", () => {
    expect(slidePosition([])).toBe(1);
    expect(slidePosition([3, 1])).toBe(6);
    expect(slidePosition([1, 2, 3])).toBe(7);
    expect(fingeringFor("slide", "D4")).toEqual({ kind: "slide", position: 6 });
    expect(fingeringFor("slide", "F#3")).toEqual({ kind: "slide", position: 7 });
  });
  it("conferidas no Woodwind Fingering Guide", () => {
    expect(keysOf(fingeringFor("clarinet", "C#4"))).toEqual(["T", "L1", "L2", "L3", "cs"]);
    expect(keysOf(fingeringFor("clarinet", "Eb4"))).toEqual(["T", "L1", "L2", "s4"]);
    expect(keysOf(fingeringFor("recorder", "Bb4"))).toEqual(["T", "L1", "L3", "R1"]);
    expect(keysOf(fingeringFor("recorder", "C#6"))).toContain("bell");
    expect(keysOf(fingeringFor("recorder", "D5"))).not.toContain("T");
    expect(keysOf(fingeringFor("recorder", "E5"))).toContain("Th");
  });
  it("nota fora da tabela: null", () => {
    expect(fingeringFor("sax", "C7")).toBeNull();
    expect(fingeringFor("recorder", "B3")).toBeNull();
  });
});

describe("em palavras", () => {
  it("pistões, vara e chaves", () => {
    expect(say("valves", { kind: "valves", valves: [1, 3] })).toBe("Pistões 1 e 3");
    expect(say("valves", { kind: "valves", valves: [] })).toBe("Nenhum pistão (solta)");
    expect(say("slide", { kind: "slide", position: 6 })).toBe("6ª posição");
    expect(say("sax", fingeringFor("sax", "D5")!)).toBe("oitava · esquerda 1 2 3 · direita 1 2 3");
    expect(say("sax", fingeringFor("sax", "Bb4")!)).toBe("esquerda 1 · bis");
    expect(say("sax", fingeringFor("sax", "Bb3")!)).toBe("esquerda 1 2 3 · direita 1 2 3 · Si♭ grave");
    expect(say("clarinet", fingeringFor("clarinet", "F4")!)).toBe("polegar");
    expect(say("recorder", fingeringFor("recorder", "E5")!)).toBe(
      "meio polegar · esquerda 1 2 3 · direita 1 2",
    );
    expect(say("recorder", fingeringFor("recorder", "C#4")!)).toBe(
      "polegar · esquerda 1 2 3 · direita 1 2 3 · metade do 4 dir.",
    );
  });
  it("o que muda da nota anterior", () => {
    expect(changes("sax", null, fingeringFor("sax", "A4")!)).toBe("");
    expect(changes("sax", fingeringFor("sax", "A4")!, fingeringFor("sax", "Bb4")!)).toBe(
      "aperta bis · solta 2 esq.",
    );
    expect(changes("valves", fingeringFor("valves", "F4")!, fingeringFor("valves", "G4")!)).toBe(
      "solta pistão 1",
    );
    expect(changes("slide", fingeringFor("slide", "F4")!, fingeringFor("slide", "G4")!)).toBe(
      "Da 3ª para a 1ª posição",
    );
  });
});

describe("instrumentos", () => {
  it("a parte da banda leva ao instrumento dos estudos", () => {
    expect(studyInstrumentForPart("Sax Tenor Sib 2")?.id).toBe("sax-tenor");
    expect(studyInstrumentForPart("Sax Alto Mib 1")?.id).toBe("sax-alto");
    expect(studyInstrumentForPart("Saxhorn Mib 1")?.id).toBe("saxhorn");
    expect(studyInstrumentForPart("Bombardino Sib 1")?.id).toBe("bombardino");
    expect(studyInstrumentForPart("Violino")).toBeUndefined();
  });
  it("transposição: Sib soa um tom abaixo, a flauta doce uma oitava acima", () => {
    const t = Object.fromEntries(STUDY_INSTRUMENTS.map((i) => [i.id, i.transpose]));
    expect(t.trompete).toBe(-2);
    expect(t["flauta-doce"]).toBe(12);
    expect(t.tuba).toBe(-33);
  });
  it("extensões", () => {
    const sax = STUDY_INSTRUMENTS.find((i) => i.id === "sax-alto")!;
    expect(chromaticNotes(...rangeOf(sax))).toHaveLength(32); // Si♭3 a Fá6
    expect(rangeOf(STUDY_INSTRUMENTS.find((i) => i.id === "flauta-doce")!)).toEqual([
      parseNote("C4").midi,
      parseNote("D6").midi,
    ]);
  });
});
