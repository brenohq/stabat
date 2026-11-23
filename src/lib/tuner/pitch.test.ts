import { describe, expect, it } from "vitest";
import { detectPitch } from "./pitch";

const SR = 48000;
const N = 4096;
const cents = (a: number, b: number) => 1200 * Math.log2(a / b);

/** um som de instrumento sintético: harmônicos com pesos, um pouco de ruído (sorteio fixo) */
function signal(freq: number, harmonics: number[] = [1], noise = 0, n = N, sr = SR): Float32Array {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    harmonics.forEach((a, h) => (v += a * Math.sin((2 * Math.PI * freq * (h + 1) * i) / sr + h)));
    x[i] = 0.3 * v + noise * rand();
  }
  return x;
}

describe("detectPitch", () => {
  it("acha a altura de senoides de Fá1 a Fá6 com erro abaixo de 1 cent", () => {
    for (let midi = 29; midi <= 89; midi += 5) {
      const f = 440 * 2 ** ((midi - 69) / 12);
      const p = detectPitch(signal(f), SR);
      expect(p, `MIDI ${midi}`).not.toBeNull();
      expect(Math.abs(cents(p!.freq, f)), `MIDI ${midi}`).toBeLessThan(1);
    }
  });

  it("sons de metal (harmônicos fortes) e com ruído: erro abaixo de 2 cents, sem contar a oitava", () => {
    const brass = [0.6, 1, 0.8, 0.5, 0.3, 0.2];
    for (const f of [55, 110, 233.08, 440, 880]) {
      const p = detectPitch(signal(f, brass, 0.05), SR);
      expect(p, `${f} Hz`).not.toBeNull();
      const c = cents(p!.freq, f);
      const offOctave = c - 1200 * Math.round(c / 1200);
      expect(Math.abs(offOctave), `${f} Hz`).toBeLessThan(2);
    }
  });

  it("tuba sem a fundamental (o microfone do celular não pega): ainda dá a altura certa", () => {
    const p = detectPitch(signal(55, [0, 1, 0.9, 0.7, 0.4]), SR);
    expect(p).not.toBeNull();
    const c = cents(p!.freq, 55);
    expect(Math.abs(c - 1200 * Math.round(c / 1200))).toBeLessThan(2);
  });

  it("enxerga 10 cents de diferença", () => {
    const f = 440 * 2 ** (10 / 1200);
    const p = detectPitch(signal(f, [1, 0.5, 0.3]), SR)!;
    expect(cents(p.freq, 440)).toBeGreaterThan(9);
    expect(cents(p.freq, 440)).toBeLessThan(11);
  });

  it("funciona também a 44,1 kHz", () => {
    const p = detectPitch(signal(440, [1, 0.5], 0, N, 44100), 44100)!;
    expect(Math.abs(cents(p.freq, 440))).toBeLessThan(1);
  });

  it("silêncio e ruído não viram nota", () => {
    expect(detectPitch(new Float32Array(N), SR)).toBeNull();
    expect(detectPitch(signal(440, [], 0.3), SR)).toBeNull();
  });
});
