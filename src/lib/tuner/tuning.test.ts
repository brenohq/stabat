import { describe, expect, it } from "vitest";
import { studyInstrumentById } from "../fingering/instruments";
import {
  advanceHold,
  advice,
  centsFrom,
  frequencyOf,
  Median,
  nearestMidi,
  noteLabel,
  referenceMidi,
  ROUND_INSTRUMENTS,
  writtenMidi,
  zoneOf,
} from "./tuning";

const inst = (id: string) => studyInstrumentById(id)!;

describe("nota de afinação de cada instrumento (Lá de concerto)", () => {
  it.each([
    ["trompete", "Si", "B"],
    ["clarinete", "Si", "B"],
    ["sax-alto", "Fá♯", "F♯"],
    ["sax-tenor", "Si", "B"],
    ["saxhorn", "Fá♯", "F♯"],
    ["trombone", "Si", "B"],
    ["bombardino", "Si", "B"],
    ["tuba", "Fá♯", "F♯"],
    ["sousafone", "Si", "B"],
    ["flauta-doce", "Lá", "A"],
  ])("%s toca %s", (id, name, letter) => {
    const n = noteLabel(writtenMidi(inst(id)));
    expect(n.name).toBe(name);
    expect(n.letter).toBe(letter);
  });

  it("a rodada tem os 10 instrumentos, a flauta doce por último", () => {
    expect(ROUND_INSTRUMENTS).toHaveLength(10);
    expect(ROUND_INSTRUMENTS.at(-1)!.id).toBe("flauta-doce");
  });
});

describe("cents", () => {
  it("sem contar a oitava", () => {
    expect(centsFrom(440)).toBeCloseTo(0);
    expect(centsFrom(55)).toBeCloseTo(0);
    expect(centsFrom(880 * 2 ** (12 / 1200))).toBeCloseTo(12);
    expect(centsFrom(110 * 2 ** (-30 / 1200))).toBeCloseTo(-30);
  });

  it("de −600 a +600: um semitom abaixo é −100", () => {
    expect(centsFrom(frequencyOf(68))).toBeCloseTo(-100);
    expect(Math.abs(centsFrom(frequencyOf(75)))).toBeCloseTo(600, 0); // trítono: tanto faz o lado
  });

  it("com outro Lá de referência", () => {
    expect(centsFrom(440, 69, 436)).toBeCloseTo(1200 * Math.log2(440 / 436));
    expect(frequencyOf(69, 442)).toBe(442);
  });

  it("nota mais perto", () => {
    expect(nearestMidi(466)).toBe(70);
    expect(nearestMidi(61)).toBe(35);
  });
});

describe("zonas e conselhos", () => {
  it("verde até ±10, amarelo até ±25", () => {
    expect(zoneOf(10)).toBe("ok");
    expect(zoneOf(-10)).toBe("ok");
    expect(zoneOf(10.5)).toBe("close");
    expect(zoneOf(-25)).toBe("close");
    expect(zoneOf(26)).toBe("off");
  });

  it("diz o que mexer em cada instrumento", () => {
    expect(advice(inst("trompete"), 3)).toBe("Afinado!");
    expect(advice(inst("trompete"), 15)).toBe("Um pouco alto: puxe a bomba geral");
    expect(advice(inst("tuba"), -40)).toBe("Baixo: empurre a bomba geral");
    expect(advice(inst("sax-alto"), 30)).toBe("Alto: puxe a boquilha um pouco para fora");
    expect(advice(inst("clarinete"), -12)).toBe("Um pouco baixo: empurre o barrilete");
    expect(advice(inst("flauta-doce"), 20)).toBe("Um pouco alto: puxe a cabeça da flauta");
    expect(advice(inst("trombone"), 20)).toBe("Um pouco alto: puxe a bomba de afinação");
  });
});

describe("rodada", () => {
  it("1,5 s seguidos no verde enchem; fora do verde esvazia", () => {
    let h = 0;
    for (let i = 0; i < 14; i++) h = advanceHold(h, 0.1, true);
    expect(h).toBeLessThan(1);
    h = advanceHold(h, 0.1, true);
    expect(h).toBeCloseTo(1);
    h = advanceHold(h, 0.3, false);
    expect(h).toBeCloseTo(0.6);
    expect(advanceHold(0.1, 1, false)).toBe(0);
  });
});

describe("referência", () => {
  it("Lá na região do instrumento, nunca abaixo do Lá3", () => {
    expect(referenceMidi(inst("trompete"))).toBe(69);
    expect(referenceMidi(inst("sax-alto"))).toBe(69);
    expect(referenceMidi(inst("trombone"))).toBe(57);
    expect(referenceMidi(inst("tuba"))).toBe(57);
    expect(referenceMidi(inst("flauta-doce"))).toBe(81);
    for (const i of ROUND_INSTRUMENTS) expect(referenceMidi(i) % 12).toBe(9);
  });
});

describe("Median", () => {
  it("ignora um salto isolado", () => {
    const m = new Median(5);
    [10, 11, 1210, 12].forEach((v) => m.push(v));
    expect(m.push(11)).toBe(11);
    m.clear();
    expect(m.push(3)).toBe(3);
  });
});
