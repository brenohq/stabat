import type { TimelineEvent } from "./types";

export interface Beat {
  t: number;
  accent: boolean;
}

/** Linha do tempo do áudio (com ritornelos) ↔ compassos da partitura. Tempos em ms. */
export class Timeline {
  readonly ev: TimelineEvent[];
  readonly duration: number;
  readonly beats: Beat[];

  constructor(events: TimelineEvent[], durationSec: number) {
    this.ev = events;
    this.duration = durationSec * 1000;
    this.beats = [];
    for (const e of events) {
      const step = (e.end - e.t) / e.beats;
      for (let b = 0; b < e.beats; b++) this.beats.push({ t: e.t + b * step, accent: b === 0 });
    }
  }

  private event(k: number): TimelineEvent {
    const e = this.ev[k];
    if (!e) throw new RangeError(`compasso tocado ${k} não existe`);
    return e;
  }

  /** índice do compasso tocado que contém ms */
  indexAt(ms: number): number {
    let lo = 0,
      hi = this.ev.length - 1,
      r = 0;
    while (lo <= hi) {
      const k = (lo + hi) >> 1;
      if (this.event(k).t <= ms) {
        r = k;
        lo = k + 1;
      } else hi = k - 1;
    }
    return r;
  }

  /** compasso da partitura e fração já tocada dele */
  at(ms: number): { k: number; m: number; frac: number } {
    const k = this.indexAt(ms);
    const e = this.event(k);
    const frac = Math.max(0, Math.min(1, (ms - e.t) / (e.end - e.t || 1)));
    return { k, m: e.m, frac };
  }

  /** ocorrência do compasso m mais próxima de nearMs (ritornelos tocam o compasso mais de uma vez) */
  occurrence(m: number, nearMs = 0): number | null {
    let best: number | null = null;
    this.ev.forEach((e, k) => {
      if (e.m !== m) return;
      if (best === null || Math.abs(e.t - nearMs) < Math.abs(this.event(best).t - nearMs)) best = k;
    });
    return best;
  }

  first(m: number): number | null {
    const k = this.ev.findIndex((e) => e.m === m);
    return k < 0 ? null : k;
  }

  startOf(k: number): number {
    return this.event(k).t;
  }

  /** trecho a..b (compassos da partitura) → [início, fim] em ms, a partir da ocorrência de a mais próxima */
  range(a: number, b: number, nearMs = 0): [number, number] | null {
    const ka = this.occurrence(a, nearMs);
    if (ka === null) return null;
    let kb = ka;
    for (let k = ka; k < this.ev.length; k++) {
      if (this.event(k).m === b) {
        kb = k;
        break;
      }
    }
    return [this.event(ka).t, this.event(kb).end];
  }

  /** duração de um tempo e número de tempos do compasso em ms */
  beatAt(ms: number): { beatMs: number; beats: number } {
    const e = this.event(this.indexAt(ms));
    return { beatMs: (e.end - e.t) / e.beats, beats: e.beats };
  }
}

export function lowerBound<T>(arr: readonly T[], v: number, key: (x: T) => number): number {
  let lo = 0,
    hi = arr.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (key(arr[m]!) < v) lo = m + 1;
    else hi = m;
  }
  return lo;
}
