/**
 * Progressão do "Bate o ritmo": repetição espaçada por célula rítmica, no mesmo espírito do
 * "Que nota é essa?". Cada célula tem uma caixa de 0 (nunca vista) a 5 (firme). Exercício com a
 * célula certa: sobe uma caixa; com ela errada: volta para a 1. As células entram uma a uma, na
 * ordem de CELLS; o nível é o da última apresentada. Puro: o sorteio vem de fora.
 */
import { CELLS, type Cell, type RhythmLevel } from "./cells";
import { generateExercise, keyOf, type Candidate, type Exercise } from "./measure";

export interface CellStat {
  box: number;
  seen: number;
  ok: number;
  /** valor de `tick` na última vez que apareceu */
  last: number;
}

export interface RhythmMemory {
  v: 1;
  cells: Record<string, CellStat>;
  /** quantas células de CELLS já foram apresentadas (as primeiras N) */
  introduced: number;
  /** exercícios feitos desde sempre */
  tick: number;
  /** últimos exercícios (true = certo), no máximo RECENT */
  recent: boolean[];
  best: number;
  /** quando jogou pela última vez (ms) */
  lastPlayed: number;
}

export const ROUND_SIZE = 10;
export const WARMUP_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
export const WARMUP_CARDS = 3;
/** semínima, mínima e semibreve já de cara */
const START_CELLS = 3;
const RECENT = 20;
const WEIGHT = [0, 8, 5, 3, 1.5, 0.7];

const emptyStat = (): CellStat => ({ box: 0, seen: 0, ok: 0, last: -99 });
export const statOf = (m: RhythmMemory, id: string): CellStat => m.cells[id] ?? emptyStat();

export function freshMemory(): RhythmMemory {
  const cells: Record<string, CellStat> = {};
  CELLS.forEach((c, i) => (cells[c.id] = { ...emptyStat(), box: i < START_CELLS ? 1 : 0 }));
  return { v: 1, cells, introduced: START_CELLS, tick: 0, recent: [], best: 0, lastPlayed: 0 };
}

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** lê o que veio do localStorage; qualquer coisa estranha vira memória nova (ou é completada) */
export function normalize(raw: unknown): RhythmMemory {
  const fresh = freshMemory();
  if (!raw || typeof raw !== "object" || (raw as { v?: unknown }).v !== 1) return fresh;
  const r = raw as Partial<RhythmMemory>;
  const introduced = isNum(r.introduced)
    ? Math.min(CELLS.length, Math.max(START_CELLS, Math.round(r.introduced)))
    : START_CELLS;
  const cells: Record<string, CellStat> = {};
  CELLS.forEach((c, i) => {
    const s = r.cells?.[c.id];
    const st =
      s && isNum(s.box) && isNum(s.seen) && isNum(s.ok) && isNum(s.last)
        ? { box: Math.min(5, Math.max(0, Math.round(s.box))), seen: s.seen, ok: s.ok, last: s.last }
        : statOf(fresh, c.id);
    if (i < introduced) st.box = Math.max(1, st.box);
    cells[c.id] = st;
  });
  return {
    v: 1,
    cells,
    introduced,
    tick: isNum(r.tick) ? r.tick : 0,
    recent: Array.isArray(r.recent) ? r.recent.filter((x) => typeof x === "boolean").slice(-RECENT) : [],
    best: isNum(r.best) ? r.best : 0,
    lastPlayed: isNum(r.lastPlayed) ? r.lastPlayed : 0,
  };
}

export const pool = (m: RhythmMemory): Cell[] => CELLS.slice(0, m.introduced);
export const levelOf = (m: RhythmMemory): RhythmLevel => CELLS[m.introduced - 1]!.level;

/** célula nova só quando todas as apresentadas estão firmes (caixa ≥ 2) e acertou 8 dos últimos 10 */
export function canIntroduce(m: RhythmMemory): boolean {
  if (m.introduced >= CELLS.length) return false;
  if (!pool(m).every((c) => statOf(m, c.id).box >= 2)) return false;
  const last = m.recent.slice(-10);
  return last.length >= 10 && last.filter(Boolean).length >= 8;
}

export function introduce(m: RhythmMemory): { memory: RhythmMemory; cell: Cell } {
  const cell = CELLS[m.introduced]!;
  const s = statOf(m, cell.id);
  return {
    cell,
    memory: {
      ...m,
      introduced: m.introduced + 1,
      // entra na caixa 1, mas ainda não ganhou um lugar entre as "firmes"
      cells: { ...m.cells, [cell.id]: { ...s, box: Math.max(1, s.box) } },
      recent: [],
    },
  };
}

/**
 * Escolha manual de nível: recomeça no começo do nível. As células dos níveis de baixo contam como
 * sabidas (caixa ≥ 3); as do nível escolhido entram uma a uma, a partir da primeira (quem chama
 * apresenta ela com `introduce`). No nível 1, volta às 3 células iniciais. As estatísticas ficam.
 */
export function startAtLevel(m: RhythmMemory, level: RhythmLevel): RhythmMemory {
  const first = CELLS.findIndex((c) => c.level === level);
  const introduced = level === 1 ? START_CELLS : first;
  const cells = { ...m.cells };
  CELLS.forEach((c, i) => {
    const s = statOf(m, c.id);
    if (c.level < level) cells[c.id] = { ...s, box: Math.max(3, s.box) };
    else if (i < introduced) cells[c.id] = { ...s, box: Math.max(1, s.box) };
  });
  return { ...m, cells, introduced, recent: [] };
}

/** voltou depois de mais de 7 dias: os primeiros exercícios só com células firmes */
export const needsWarmup = (m: RhythmMemory, now: number): boolean =>
  m.lastPlayed > 0 && now - m.lastPlayed > WARMUP_AFTER_MS;

export function weightOf(m: RhythmMemory, c: Cell): number {
  const s = statOf(m, c.id);
  let w = WEIGHT[Math.max(1, s.box)]! * (1 + Math.min(m.tick - s.last, 30) / 8);
  if (s.seen < 3) w *= 1.5;
  return w;
}

/** o próximo exercício: peso por caixa; a célula mais nova aparece até ser vista 3 vezes */
export function nextExercise(
  m: RhythmMemory,
  {
    prev,
    warmup = false,
    random = Math.random,
  }: { prev?: Exercise; warmup?: boolean; random?: () => number } = {},
): Exercise {
  const all = pool(m);
  const firm = warmup ? all.filter((c) => statOf(m, c.id).box >= 3) : [];
  // a semínima fica sempre: é ela que garante que todo compasso se completa
  const base = firm.length >= 2 ? [...new Set([CELLS[0]!, ...firm])] : all;
  const cands: Candidate[] = base.map((cell) => ({ cell, weight: weightOf(m, cell) }));
  const newest = all[all.length - 1]!;
  const must = !warmup && statOf(m, newest.id).seen < 3 ? newest : null;
  return generateExercise(cands, { must, prevKey: prev ? keyOf(prev) : undefined, random });
}

/** registra um exercício: caixa de cada célula que apareceu, sequência recente */
export function gradeExercise(m: RhythmMemory, ex: Exercise, outcomes: boolean[], now: number): RhythmMemory {
  const byCell = new Map<string, boolean>();
  ex.cells.forEach((p, i) => byCell.set(p.cell.id, (byCell.get(p.cell.id) ?? true) && outcomes[i]!));
  const cells = { ...m.cells };
  for (const [id, ok] of byCell) {
    const s = statOf(m, id);
    cells[id] = {
      box: ok ? Math.min(5, s.box + 1) : 1,
      seen: s.seen + 1,
      ok: s.ok + (ok ? 1 : 0),
      last: m.tick,
    };
  }
  const ok = outcomes.every(Boolean);
  return { ...m, cells, tick: m.tick + 1, recent: [...m.recent, ok].slice(-RECENT), lastPlayed: now };
}
