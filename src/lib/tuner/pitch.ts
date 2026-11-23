/**
 * Altura de um trecho de som pelo método de McLeod (MPM): função de diferença quadrada
 * normalizada (NSDF), calculada com FFT, e o primeiro pico perto do maior. Puro (sem DOM).
 *
 * Errar a oitava (pegar o 2º harmônico dos graves) não atrapalha o afinador: os cents são
 * contados sem a oitava (ver tuning.ts).
 */

export interface Pitch {
  /** Hz */
  freq: number;
  /** 0–1: quão periódico é o som (acima de ~0,9 = nota limpa) */
  clarity: number;
}

export interface PitchOptions {
  minHz?: number;
  maxHz?: number;
  /** um pico vale se passa desta fração do maior (o "k" do MPM) */
  peakRatio?: number;
  /** abaixo disto é ruído, não nota */
  minClarity?: number;
  /** volume (RMS) mínimo para tentar */
  minRms?: number;
}

const DEFAULTS: Required<PitchOptions> = {
  minHz: 40,
  maxHz: 1600,
  peakRatio: 0.9,
  minClarity: 0.8,
  minRms: 0.005,
};

/** FFT complexa, radix 2, no lugar (n potência de 2) */
function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b]! * cr - im[b]! * ci;
        const xi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

/** r(τ) = Σ x[j]·x[j+τ], para τ = 0…n−1 */
function autocorrelation(x: ArrayLike<number>): Float64Array {
  const n = x.length;
  let size = 1;
  while (size < 2 * n) size <<= 1;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let i = 0; i < n; i++) re[i] = x[i]!;
  fft(re, im);
  for (let i = 0; i < size; i++) {
    re[i] = re[i]! * re[i]! + im[i]! * im[i]!;
    im[i] = 0;
  }
  fft(re, im, true);
  const r = new Float64Array(n);
  for (let i = 0; i < n; i++) r[i] = re[i]! / size;
  return r;
}

/** NSDF: n(τ) = 2·r(τ) / Σ (x[j]² + x[j+τ]²), entre −1 e 1 */
export function nsdf(x: ArrayLike<number>, maxLag = x.length - 1): Float64Array {
  const n = x.length;
  const r = autocorrelation(x);
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cum[i + 1] = cum[i]! + x[i]! * x[i]!;
  const out = new Float64Array(Math.min(maxLag, n - 1) + 1);
  for (let tau = 0; tau < out.length; tau++) {
    const m = cum[n - tau]! + cum[n]! - cum[tau]!;
    out[tau] = m > 0 ? (2 * r[tau]!) / m : 0;
  }
  return out;
}

export function rms(x: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / Math.max(1, x.length));
}

/** a altura do trecho, ou null se for silêncio ou ruído */
export function detectPitch(
  x: ArrayLike<number>,
  sampleRate: number,
  options: PitchOptions = {},
): Pitch | null {
  const o = { ...DEFAULTS, ...options };
  if (x.length < 64 || rms(x) < o.minRms) return null;
  const minLag = Math.max(2, Math.floor(sampleRate / o.maxHz));
  const maxLag = Math.min(x.length - 2, Math.ceil(sampleRate / o.minHz));
  const d = nsdf(x, maxLag + 1);

  // um pico por trecho positivo (depois do lóbulo do τ = 0)
  const peaks: { tau: number; value: number }[] = [];
  let tau = 1;
  while (tau < d.length && d[tau]! > 0) tau++;
  while (tau < d.length - 1) {
    while (tau < d.length - 1 && d[tau]! <= 0) tau++;
    let best = -1;
    while (tau < d.length - 1 && d[tau]! > 0) {
      if (best < 0 || d[tau]! > d[best]!) best = tau;
      tau++;
    }
    if (best >= minLag && best <= maxLag) {
      // interpolação parabólica: o pico verdadeiro entre as amostras
      const a = d[best - 1]!;
      const b = d[best]!;
      const c = d[best + 1] ?? b;
      const den = a - 2 * b + c;
      const shift = den === 0 ? 0 : (0.5 * (a - c)) / den;
      peaks.push({ tau: best + shift, value: b - 0.25 * (a - c) * shift });
    }
  }
  if (!peaks.length) return null;
  const top = Math.max(...peaks.map((p) => p.value));
  const pick = peaks.find((p) => p.value >= o.peakRatio * top)!;
  if (pick.value < o.minClarity) return null;
  return { freq: sampleRate / pick.tau, clarity: Math.min(1, pick.value) };
}
