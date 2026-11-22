/**
 * Sorteio do exercício do "Bate o ritmo": dois compassos 4/4 montados com células, com peso.
 * Puro: o sorteio (random) vem de fora.
 */
import {
  BEATS_PER_MEASURE,
  MEASURE,
  MEASURES,
  SIXTEENTHS_PER_BEAT,
  beatsOf,
  fitsAt,
  type Cell,
} from "./cells";

export interface PlacedCell {
  cell: Cell;
  /** em semicolcheias desde o começo do exercício */
  on: number;
}

/** uma nota ou pausa do exercício */
export interface RhythmEvent {
  /** em semicolcheias desde o começo do exercício (0 … 31) */
  on: number;
  dur: number;
  rest: boolean;
  /** índice em `cells` da célula a que pertence */
  cell: number;
}

export interface Exercise {
  cells: PlacedCell[];
  events: RhythmEvent[];
}

export const EXERCISE_LENGTH = MEASURE * MEASURES;

export function eventsOf(cells: PlacedCell[]): RhythmEvent[] {
  const out: RhythmEvent[] = [];
  cells.forEach((p, ci) => {
    let on = p.on;
    for (const d of p.cell.durs) {
      out.push({ on, dur: Math.abs(d), rest: d < 0, cell: ci });
      on += Math.abs(d);
    }
  });
  return out;
}

export const keyOf = (ex: Exercise): string => ex.cells.map((p) => p.cell.id).join(",");

export interface Candidate {
  cell: Cell;
  weight: number;
}

function pick(cands: Candidate[], random: () => number): Cell {
  const total = cands.reduce((a, c) => a + c.weight, 0);
  let r = random() * total;
  for (const c of cands) {
    r -= c.weight;
    if (r <= 0) return c.cell;
  }
  return cands[cands.length - 1]!.cell;
}

function measureOf(cands: Candidate[], start: number, random: () => number): PlacedCell[] {
  const out: PlacedCell[] = [];
  let beat = 0;
  while (beat < BEATS_PER_MEASURE) {
    const fit = cands.filter((c) => c.weight > 0 && fitsAt(c.cell, beat));
    const cell = pick(fit, random);
    out.push({ cell, on: start + beat * SIXTEENTHS_PER_BEAT });
    beat += beatsOf(cell);
  }
  return out;
}

/**
 * Sorteia dois compassos. Regras: no máximo 2 pausas por compasso, ao menos 3 notas no exercício,
 * a célula `must` (a mais nova, ainda fraca) aparece, e não repete o exercício anterior (`prevKey`).
 * Os candidatos precisam incluir uma célula que cabe em qualquer tempo (a semínima).
 */
export function generateExercise(
  cands: Candidate[],
  {
    must,
    prevKey,
    random = Math.random,
  }: { must?: Cell | null; prevKey?: string; random?: () => number } = {},
): Exercise {
  let fallback: Exercise | null = null;
  for (let tries = 0; tries < 400; tries++) {
    const cells: PlacedCell[] = [];
    for (let m = 0; m < MEASURES; m++) cells.push(...measureOf(cands, m * MEASURE, random));
    const events = eventsOf(cells);
    const ex = { cells, events };
    const notes = events.filter((e) => !e.rest).length;
    const restsOk = [0, 1].every(
      (m) => events.filter((e) => e.rest && Math.floor(e.on / MEASURE) === m).length <= 2,
    );
    if (notes < 3 || !restsOk) continue;
    fallback ??= ex;
    if (must && !cells.some((p) => p.cell.id === must.id)) continue;
    if (prevKey && keyOf(ex) === prevKey) continue;
    return ex;
  }
  return fallback ?? { cells: [], events: [] };
}
