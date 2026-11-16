import { describe, expect, it } from "vitest";
import { DEFAULT_PART_MIX, PART_BOOST, mixGains, mixLevels, partGain } from "./mix";

describe("mixagem da parte", () => {
  it("padrão é 85% minha parte / 15% banda", () => {
    expect(DEFAULT_PART_MIX).toBe(85);
    const l = mixLevels(DEFAULT_PART_MIX);
    expect(l.me).toBeCloseTo(0.85);
    expect(l.band).toBeCloseTo(0.15);
  });
  it("lado mais alto no volume cheio, proporção mantida", () => {
    const g = mixGains(85);
    expect(g.me).toBeCloseTo(PART_BOOST);
    expect(g.band).toBeCloseTo(0.15 / 0.85);
  });
  it("extremos: só banda e só minha parte", () => {
    expect(mixGains(0)).toEqual({ me: 0, band: 1 });
    expect(mixGains(100)).toEqual({ me: PART_BOOST, band: 0 });
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
