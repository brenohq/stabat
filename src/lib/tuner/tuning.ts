/**
 * Regras do Afinador: a banda afina no Lá de concerto; cada músico vê a nota que ele lê
 * (já transposta), quanto está alto ou baixo (em cents, sem contar a oitava) e o que mexer.
 */
import { LETTERS, NAMES, NOTE_COLORS } from "../games/notes";
import { rangeOf, STUDY_INSTRUMENTS, type StudyInstrument } from "../fingering/instruments";
import type { Mechanism } from "../fingering/tables";

/** Lá de concerto (MIDI 69 = Lá4) */
export const TUNING_MIDI = 69;
/** Lá de referência, em Hz */
export const DEFAULT_A4 = 440;
export const A4_MIN = 436;
export const A4_MAX = 446;
/** até aqui é afinado (verde) */
export const IN_TUNE_CENTS = 10;
/** até aqui é "um pouco" (amarelo); além, vermelho */
export const CLOSE_CENTS = 25;
/** além disto o músico tocou outra nota */
export const WRONG_NOTE_CENTS = 50;
/** tempo seguido no verde para a rodada marcar "afinado" */
export const HOLD_SECONDS = 1.5;

/** a ordem da lista da rodada: madeiras, metais agudos, metais graves e, por último, a flauta doce */
export const ROUND_ORDER = [
  "clarinete",
  "sax-alto",
  "sax-tenor",
  "trompete",
  "saxhorn",
  "trombone",
  "bombardino",
  "tuba",
  "sousafone",
  "flauta-doce",
];
export const ROUND_INSTRUMENTS: StudyInstrument[] = ROUND_ORDER.map((id) =>
  STUDY_INSTRUMENTS.find((i) => i.id === id)!,
);

// por altura (0 = Dó): índice da letra e alteração; as pretas com sustenido
const PC: [letter: number, sharp: boolean][] = [
  [0, false],
  [0, true],
  [1, false],
  [1, true],
  [2, false],
  [3, false],
  [3, true],
  [4, false],
  [4, true],
  [5, false],
  [5, true],
  [6, false],
];
const pcOf = (midi: number) => ((midi % 12) + 12) % 12;

export interface NoteLabel {
  /** "Fá♯" */
  name: string;
  /** "F♯" */
  letter: string;
  /** a cor da letra, como no "Que nota é essa?" */
  color: string;
}

export function noteLabel(midi: number): NoteLabel {
  const [l, sharp] = PC[pcOf(midi)]!;
  const s = sharp ? "♯" : "";
  return { name: NAMES[l] + s, letter: LETTERS[l] + s, color: NOTE_COLORS[l]! };
}

/** a nota escrita que o instrumento toca para soar `concertMidi` (Lá de concerto: trompete → Si) */
export const writtenMidi = (inst: StudyInstrument, concertMidi = TUNING_MIDI) => concertMidi - inst.transpose;

export const frequencyOf = (midi: number, a4 = DEFAULT_A4) => a4 * 2 ** ((midi - 69) / 12);

/** quantos cents `freq` está acima (+) ou abaixo (−) da nota, sem contar a oitava: −600 a +600 */
export function centsFrom(freq: number, targetMidi = TUNING_MIDI, a4 = DEFAULT_A4): number {
  const c = 1200 * Math.log2(freq / frequencyOf(targetMidi, a4));
  const r = (((c % 1200) + 1200) % 1200) - 1200;
  return r < -600 ? r + 1200 : r;
}

/** a nota de concerto mais perto de `freq` */
export const nearestMidi = (freq: number, a4 = DEFAULT_A4) => Math.round(69 + 12 * Math.log2(freq / a4));

export type Zone = "ok" | "close" | "off";
export function zoneOf(cents: number): Zone {
  const a = Math.abs(cents);
  return a <= IN_TUNE_CENTS ? "ok" : a <= CLOSE_CENTS ? "close" : "off";
}

/** o que mexer em cada instrumento: [quando está alto, quando está baixo] */
const ADJUST: Record<Mechanism, [sharp: string, flat: string]> = {
  valves: ["puxe a bomba geral", "empurre a bomba geral"],
  slide: ["puxe a bomba de afinação", "empurre a bomba de afinação"],
  sax: ["puxe a boquilha um pouco para fora", "empurre a boquilha no tudel"],
  clarinet: ["puxe o barrilete", "empurre o barrilete"],
  recorder: ["puxe a cabeça da flauta", "empurre a cabeça da flauta"],
};

/** a frase do que fazer: "Um pouco alto: puxe a bomba geral" */
export function advice(inst: StudyInstrument, cents: number): string {
  const zone = zoneOf(cents);
  if (zone === "ok") return "Afinado!";
  const [sharp, flat] = ADJUST[inst.mechanism];
  const high = cents > 0;
  const word = high ? "alto" : "baixo";
  return `${zone === "close" ? `Um pouco ${word}` : word[0]!.toUpperCase() + word.slice(1)}: ${high ? sharp : flat}`;
}

/** o tempo no verde da rodada (0–1): enche em HOLD_SECONDS, esvazia duas vezes mais rápido */
export function advanceHold(hold: number, dt: number, inTune: boolean): number {
  return inTune ? Math.min(1, hold + dt / HOLD_SECONDS) : Math.max(0, hold - (2 * dt) / HOLD_SECONDS);
}

/**
 * A nota de referência que o afinador toca: o Lá de concerto na região do instrumento
 * (a nota escrita mais perto do meio da extensão), nunca abaixo do Lá3, que o alto-falante
 * do celular ainda toca bem.
 */
export function referenceMidi(inst: StudyInstrument): number {
  const [lo, hi] = rangeOf(inst);
  const mid = (lo + hi) / 2;
  const w = writtenMidi(inst);
  let best = w;
  for (let m = w - 48; m <= w + 48; m += 12) if (Math.abs(m - mid) < Math.abs(best - mid)) best = m;
  let concert = best + inst.transpose;
  while (concert < 57) concert += 12;
  return concert;
}

/** mediana dos últimos valores: tira os saltos de uma leitura só (ex.: um harmônico) */
export class Median {
  private values: number[] = [];
  constructor(private size = 5) {}
  push(v: number): number {
    this.values.push(v);
    if (this.values.length > this.size) this.values.shift();
    const s = [...this.values].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
  }
  clear(): void {
    this.values = [];
  }
}
