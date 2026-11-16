import { describe, expect, it } from "vitest";
import { Timeline, lowerBound } from "./timeline";

// 4 compassos de 2 s (4/4 a 120 bpm), com ritornelo nos compassos 1–2: 0 1 2 1 2 3
const ev = [0, 1, 2, 1, 2, 3].map((m, k) => ({ m, t: k * 2000, end: (k + 1) * 2000, beats: 4 }));
const tl = new Timeline(ev, 12);

describe("Timeline", () => {
  it("acha o compasso e a fração tocada", () => {
    expect(tl.at(0)).toEqual({ k: 0, m: 0, frac: 0 });
    expect(tl.at(3000)).toEqual({ k: 1, m: 1, frac: 0.5 });
    expect(tl.at(7000).m).toBe(1); // segunda vez do compasso 1
    expect(tl.at(99999).m).toBe(3);
  });

  it("escolhe a ocorrência mais próxima da posição atual", () => {
    expect(tl.occurrence(1, 0)).toBe(1);
    expect(tl.occurrence(1, 9000)).toBe(3);
    expect(tl.occurrence(9)).toBeNull();
  });

  it("primeira ocorrência", () => {
    expect(tl.first(2)).toBe(2);
    expect(tl.first(7)).toBeNull();
  });

  it("trecho a..b segue a passagem certa do ritornelo", () => {
    expect(tl.range(1, 2, 0)).toEqual([2000, 6000]);
    expect(tl.range(1, 2, 7000)).toEqual([6000, 10000]);
    expect(tl.range(2, 3, 0)).toEqual([4000, 12000]); // de 2 (1ª vez) até o 3, que só vem depois da repetição
  });

  it("gera os tempos do metrônomo com acento no 1º tempo", () => {
    expect(tl.beats).toHaveLength(24);
    expect(tl.beats.slice(0, 5)).toEqual([
      { t: 0, accent: true },
      { t: 500, accent: false },
      { t: 1000, accent: false },
      { t: 1500, accent: false },
      { t: 2000, accent: true },
    ]);
    expect(tl.beatAt(2500)).toEqual({ beatMs: 500, beats: 4 });
  });

  it("lowerBound", () => {
    expect(lowerBound([1, 3, 5], 3, (x) => x)).toBe(1);
    expect(lowerBound([1, 3, 5], 6, (x) => x)).toBe(3);
  });
});
