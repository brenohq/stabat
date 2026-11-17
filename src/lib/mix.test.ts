import { describe, expect, it } from "vitest";
import { measureLoudness } from "./loudness";
import { DEFAULT_PART_MIX, PART_BOOST, matchGains, mixGains, mixLevels, partGain } from "./mix";

describe("mixagem da parte", () => {
  it("padrão é 90% minha parte / 10% banda", () => {
    expect(DEFAULT_PART_MIX).toBe(90);
    const l = mixLevels(DEFAULT_PART_MIX);
    expect(l.me).toBeCloseTo(0.9);
    expect(l.band).toBeCloseTo(0.1);
  });
  it("lado mais alto no volume cheio, proporção mantida", () => {
    const g = mixGains(90);
    expect(g.me).toBeCloseTo(PART_BOOST);
    expect(g.band).toBeCloseTo(0.1 / 0.9);
  });
  it("extremos: só banda e só minha parte", () => {
    expect(mixGains(0)).toEqual({ me: 0, band: 1 });
    expect(mixGains(100)).toEqual({ me: PART_BOOST, band: 0 });
  });
});

describe("igualar parte e banda", () => {
  const db = (x: number) => 20 * Math.log10(x);
  it("parte 20 dB abaixo da banda sobe até a banda (com a banda 6 dB abaixo)", () => {
    const m = matchGains({ db: -40, peak: 0.05 }, { db: -20, peak: 0.8 });
    expect(db(m.band)).toBeCloseTo(-6, 5);
    expect(db(m.me)).toBeCloseTo(14, 5); // -40 + 14 = -20 - 6
    // em 50% as duas soam iguais; em 90%, parte ~19 dB acima
    const g50 = mixGains(50, m);
    expect(db(g50.me) - 40).toBeCloseTo(db(g50.band) - 20, 5);
    const g90 = mixGains(90, m);
    expect(db(g90.me) - 40 - (db(g90.band) - 20)).toBeCloseTo(db(90 / 10), 5);
  });
  it("não deixa o pico da parte passar de 0,9", () => {
    const m = matchGains({ db: -40, peak: 0.5 }, { db: -20, peak: 0.8 });
    expect(m.me * 0.5).toBeCloseTo(0.9, 5);
  });
  it("sem medição, volta ao realce fixo", () => {
    expect(matchGains(null, { db: -20, peak: 1 })).toEqual({ me: PART_BOOST, band: 1 });
    expect(matchGains({ db: -Infinity, peak: 0 }, { db: -20, peak: 1 })).toEqual({ me: PART_BOOST, band: 1 });
  });
});

describe("medir volume", () => {
  const sine = (amp: number, seconds: number, sr = 8000) =>
    Float32Array.from({ length: seconds * sr }, (_, i) => amp * Math.sin((2 * Math.PI * 440 * i) / sr));
  it("senoide de amplitude 1 ≈ −3 dB, pico 1", () => {
    const l = measureLoudness([sine(1, 2)], 8000);
    expect(l.db).toBeCloseTo(-3.01, 1);
    expect(l.peak).toBeCloseTo(1, 2);
  });
  it("pausas longas não puxam o volume para baixo", () => {
    const sr = 8000;
    const x = new Float32Array(10 * sr);
    x.set(sine(0.5, 2), 0);
    expect(measureLoudness([x], sr).db).toBeCloseTo(-9.03, 1);
  });
  it("silêncio total", () => {
    expect(measureLoudness([new Float32Array(8000)], 8000).db).toBe(-Infinity);
  });
});

describe("volume no arranjo", () => {
  it("ligados tocam; solo tem prioridade", () => {
    const on = new Set([0, 1]);
    expect(partGain(0, on, new Set())).toBe(1);
    expect(partGain(2, on, new Set())).toBe(0);
    expect(partGain(0, on, new Set([1]))).toBe(0);
    expect(partGain(2, on, new Set([2]))).toBe(1);
  });
});
