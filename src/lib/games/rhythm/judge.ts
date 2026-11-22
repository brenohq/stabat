/**
 * Julgamento dos toques do "Bate o ritmo". Tempos em segundos desde o começo do exercício
 * (o 1 do primeiro compasso), já corrigidos pelo atraso do som. Só o ataque conta, não a duração.
 */
import { MEASURE, SIXTEENTHS_PER_BEAT, type RhythmLevel } from "./cells";
import type { Exercise } from "./measure";

/** fração da distância até a nota vizinha que a janela de "bom" pode ocupar (nunca se encostam) */
export const GAP_SHARE = 0.45;

/**
 * Tolerância por nível: janela máxima de "bom" (s) e que fração dela é "perfeito". O nível 1 é o
 * mais folgado, o 2 um pouco menos; do 3 em diante, o padrão.
 */
export const TOLERANCE: Record<RhythmLevel, { goodMax: number; perfectShare: number }> = {
  1: { goodMax: 0.22, perfectShare: 0.5 },
  2: { goodMax: 0.17, perfectShare: 0.5 },
  3: { goodMax: 0.13, perfectShare: 0.45 },
  4: { goodMax: 0.13, perfectShare: 0.45 },
  5: { goodMax: 0.13, perfectShare: 0.45 },
};

export interface Windows {
  good: number;
  perfect: number;
}

/** janelas para estes ataques, no nível do músico: nunca passam de 45% da distância até a vizinha */
export function windowsFor(onsets: number[], level: RhythmLevel = 3): Windows {
  const t = TOLERANCE[level];
  let gap = Infinity;
  for (let i = 1; i < onsets.length; i++) gap = Math.min(gap, onsets[i]! - onsets[i - 1]!);
  const good = Math.min(t.goodMax, GAP_SHARE * gap);
  return { good, perfect: good * t.perfectShare };
}

export type Grade = "perfect" | "good" | "miss";

export interface NoteResult {
  grade: Grade;
  /** toque − ataque (s); negativo = cedo */
  offset: number;
  /** índice do toque que casou, ou −1 */
  tap: number;
}

export interface Judgement {
  notes: NoteResult[];
  /** índices dos toques que não casaram com nota nenhuma */
  extras: number[];
  ok: boolean;
}

/** casa toques com ataques, do par mais próximo para o mais distante, um toque por nota */
export function judge(onsets: number[], taps: number[], w: Windows): Judgement {
  const pairs: { i: number; j: number; d: number }[] = [];
  onsets.forEach((o, i) =>
    taps.forEach((t, j) => {
      const d = t - o;
      if (Math.abs(d) <= w.good + 1e-9) pairs.push({ i, j, d });
    }),
  );
  pairs.sort((a, b) => Math.abs(a.d) - Math.abs(b.d));
  const notes: NoteResult[] = onsets.map(() => ({ grade: "miss", offset: 0, tap: -1 }));
  const used = new Set<number>();
  for (const p of pairs) {
    if (notes[p.i]!.tap >= 0 || used.has(p.j)) continue;
    notes[p.i] = { grade: Math.abs(p.d) <= w.perfect + 1e-9 ? "perfect" : "good", offset: p.d, tap: p.j };
    used.add(p.j);
  }
  const extras = taps.map((_, j) => j).filter((j) => !used.has(j));
  return { notes, extras, ok: extras.length === 0 && notes.every((n) => n.grade !== "miss") };
}

/** ataques (s) das notas do exercício, a este andamento */
export function onsetsOf(ex: Exercise, bpm: number): number[] {
  const sixteenth = 60 / bpm / SIXTEENTHS_PER_BEAT;
  return ex.events.filter((e) => !e.rest).map((e) => e.on * sixteenth);
}

/** cada célula do exercício foi tocada certa? (todas as notas dela e nenhum toque a mais no seu trecho) */
export function cellOutcomes(ex: Exercise, j: Judgement, taps: number[], bpm: number): boolean[] {
  const sixteenth = 60 / bpm / SIXTEENTHS_PER_BEAT;
  const ok = ex.cells.map(() => true);
  ex.events
    .filter((e) => !e.rest)
    .forEach((e, k) => {
      if (j.notes[k]!.grade === "miss") ok[e.cell] = false;
    });
  for (const t of j.extras) ok[cellAt(ex, taps[t]! / sixteenth)] = false;
  return ok;
}

/** a célula cujo trecho contém esta posição (em semicolcheias); antes/depois de tudo, a primeira/última */
function cellAt(ex: Exercise, pos: number): number {
  let found = 0;
  ex.cells.forEach((p, i) => {
    if (pos >= p.on - 0.5) found = i;
  });
  return found;
}

export type Issue =
  | { kind: "miss"; note: number; measure: number; beat: number }
  | { kind: "extra"; rest: boolean; measure: number; beat: number }
  | { kind: "none" };

/** o primeiro problema no tempo (nota que faltou ou toque a mais), para a dica */
export function firstIssue(ex: Exercise, j: Judgement, taps: number[], bpm: number): Issue {
  const sixteenth = 60 / bpm / SIXTEENTHS_PER_BEAT;
  const where = (pos: number) => {
    const p = Math.max(0, Math.min(MEASURE * 2 - 0.01, pos));
    return {
      measure: Math.floor(p / MEASURE) + 1,
      beat: Math.floor((p % MEASURE) / SIXTEENTHS_PER_BEAT) + 1,
    };
  };
  const notes = ex.events.filter((e) => !e.rest);
  const issues: { pos: number; issue: Issue }[] = [];
  j.notes.forEach((n, k) => {
    if (n.grade === "miss") {
      const pos = notes[k]!.on;
      issues.push({ pos, issue: { kind: "miss", note: k + 1, ...where(pos) } });
    }
  });
  for (const t of j.extras) {
    const pos = taps[t]! / sixteenth;
    const rest = ex.events.some((e) => e.rest && pos >= e.on - 0.5 && pos < e.on + e.dur - 0.5);
    issues.push({ pos, issue: { kind: "extra", rest, ...where(Math.round(pos)) } });
  }
  issues.sort((a, b) => a.pos - b.pos);
  return issues[0]?.issue ?? { kind: "none" };
}

/** tendência da rodada pela mediana dos desvios (s): correndo, arrastando ou nenhuma */
export function tendency(offsets: number[], threshold = 0.035): "early" | "late" | null {
  if (offsets.length < 8) return null;
  const s = [...offsets].sort((a, b) => a - b);
  const mid = s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
  return mid <= -threshold ? "early" : mid >= threshold ? "late" : null;
}

/** ajuste do atraso: mediana das diferenças toque − clique (ms), só dos toques perto de um clique */
export function calibrate(taps: number[], clicks: number[], near = 0.3): { offsetMs: number; used: number } {
  const diffs: number[] = [];
  for (const t of taps) {
    let best: number | null = null;
    for (const c of clicks) {
      const d = t - c;
      if (Math.abs(d) < near && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }
    if (best !== null) diffs.push(best * 1000);
  }
  if (!diffs.length) return { offsetMs: 0, used: 0 };
  diffs.sort((a, b) => a - b);
  return { offsetMs: diffs[Math.floor(diffs.length / 2)]!, used: diffs.length };
}
