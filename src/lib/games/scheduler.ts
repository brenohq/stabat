/**
 * Repetição espaçada do "Que nota é essa?" (caixas de Leitner, simplificadas).
 *
 * Cada nota tem uma caixa de 0 (nunca vista) a 5 (domina). Acertou rápido: sobe uma caixa.
 * Acertou devagar: sobe só até a 2. Errou: volta para a 1. A próxima nota é sorteada entre as já
 * apresentadas, com peso pela caixa × tempo desde a última vez — o que se erra volta logo, o que
 * se sabe volta de vez em quando, mas nunca some. Notas novas entram uma a uma, na ordem de NOTES.
 *
 * Tudo puro: as funções devolvem uma memória nova e recebem o sorteio (random) de fora.
 */
import { NOTES, type GameNote, type Level } from "./notes";

export interface NoteStat {
  box: number;
  seen: number;
  ok: number;
  /** valor de `tick` na última vez que apareceu */
  last: number;
}

export interface Memory {
  v: 1;
  notes: Record<string, NoteStat>;
  /** quantas notas de NOTES já foram apresentadas (as primeiras N) */
  introduced: number;
  /** respostas dadas desde sempre */
  tick: number;
  /** últimas respostas (true = acerto), no máximo RECENT */
  recent: boolean[];
  /** trocas: "certa>respondida" (índices de NAMES) → vezes */
  confusions: Record<string, number>;
  best: number;
  /** quando jogou pela última vez (ms) */
  lastPlayed: number;
}

export const ROUND_SIZE = 10;
export const FAST_MS = 3000;
export const WARMUP_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
export const WARMUP_CARDS = 3;
const START_NOTES = 3;
const RECENT = 20;
const WEIGHT = [0, 8, 5, 3, 1.5, 0.7];

const emptyStat = (): NoteStat => ({ box: 0, seen: 0, ok: 0, last: -99 });
/** estatística de uma nota (toda memória normalizada tem todas as notas) */
export const statOf = (m: Memory, id: string): NoteStat => m.notes[id] ?? emptyStat();

export function freshMemory(): Memory {
  const notes: Record<string, NoteStat> = {};
  NOTES.forEach((n, i) => (notes[n.id] = { ...emptyStat(), box: i < START_NOTES ? 1 : 0 }));
  return {
    v: 1,
    notes,
    introduced: START_NOTES,
    tick: 0,
    recent: [],
    confusions: {},
    best: 0,
    lastPlayed: 0,
  };
}

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** lê o que veio do localStorage; qualquer coisa estranha vira memória nova (ou é completada) */
export function normalize(raw: unknown): Memory {
  const fresh = freshMemory();
  if (!raw || typeof raw !== "object" || (raw as { v?: unknown }).v !== 1) return fresh;
  const r = raw as Partial<Memory>;
  const notes: Record<string, NoteStat> = {};
  for (const n of NOTES) {
    const s = r.notes?.[n.id];
    notes[n.id] =
      s && isNum(s.box) && isNum(s.seen) && isNum(s.ok) && isNum(s.last)
        ? { box: Math.min(5, Math.max(0, Math.round(s.box))), seen: s.seen, ok: s.ok, last: s.last }
        : statOf(fresh, n.id);
  }
  const introduced = isNum(r.introduced)
    ? Math.min(NOTES.length, Math.max(START_NOTES, Math.round(r.introduced)))
    : START_NOTES;
  for (const n of NOTES.slice(0, introduced)) {
    const st = notes[n.id];
    if (st) st.box = Math.max(1, st.box);
  }
  return {
    v: 1,
    notes,
    introduced,
    tick: isNum(r.tick) ? r.tick : 0,
    recent: Array.isArray(r.recent) ? r.recent.filter((x) => typeof x === "boolean").slice(-RECENT) : [],
    confusions: r.confusions && typeof r.confusions === "object" ? { ...r.confusions } : {},
    best: isNum(r.best) ? r.best : 0,
    lastPlayed: isNum(r.lastPlayed) ? r.lastPlayed : 0,
  };
}

export const pool = (m: Memory): GameNote[] => NOTES.slice(0, m.introduced);
export const levelOf = (m: Memory): Level => NOTES[m.introduced - 1]!.level;

/** nota nova só quando todas as apresentadas estão firmes (caixa ≥ 2) e acertou 8 das últimas 10 */
export function canIntroduce(m: Memory): boolean {
  if (m.introduced >= NOTES.length) return false;
  if (!pool(m).every((n) => statOf(m, n.id).box >= 2)) return false;
  const last = m.recent.slice(-10);
  return last.length >= 10 && last.filter(Boolean).length >= 8;
}

export function introduce(m: Memory): { memory: Memory; note: GameNote } {
  const note = NOTES[m.introduced]!;
  const s = statOf(m, note.id);
  return {
    note,
    memory: {
      ...m,
      introduced: m.introduced + 1,
      notes: { ...m.notes, [note.id]: { ...s, box: Math.max(1, s.box) } },
    },
  };
}

/** errou 3 das últimas 5: as notas conhecidas pesam o triplo até firmar de novo */
export function isCalm(m: Memory): boolean {
  const last = m.recent.slice(-5);
  return last.length === 5 && last.filter((x) => !x).length >= 3;
}

/** voltou depois de mais de 7 dias: as primeiras notas da sessão são fáceis */
export const needsWarmup = (m: Memory, now: number): boolean =>
  m.lastPlayed > 0 && now - m.lastPlayed > WARMUP_AFTER_MS;

export function weightOf(m: Memory, note: GameNote, calm: boolean): number {
  const s = statOf(m, note.id);
  let w = WEIGHT[Math.max(1, s.box)]! * (1 + Math.min(m.tick - s.last, 30) / 8);
  if (s.seen < 3) w *= 1.5;
  if (calm && s.box >= 3) w *= 3;
  return w;
}

export function pickNext(
  m: Memory,
  {
    prevId,
    warmup = false,
    random = Math.random,
  }: { prevId?: string; warmup?: boolean; random?: () => number } = {},
): GameNote {
  const all = pool(m);
  const known = warmup ? all.filter((n) => statOf(m, n.id).box >= 3) : [];
  const base = known.length > 1 ? known : all;
  const cand = base.length > 1 ? base.filter((n) => n.id !== prevId) : base;
  const calm = isCalm(m);
  const ws = cand.map((n) => weightOf(m, n, calm));
  let r = random() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cand.length; i++) {
    r -= ws[i]!;
    if (r <= 0) return cand[i]!;
  }
  return cand[cand.length - 1]!;
}

export function grade(m: Memory, note: GameNote, answer: number, ms: number, now: number): Memory {
  const ok = answer === note.idx;
  const s = statOf(m, note.id);
  const box = ok ? (ms < FAST_MS ? Math.min(5, s.box + 1) : Math.max(s.box, Math.min(s.box + 1, 2))) : 1;
  const confusions = { ...m.confusions };
  if (!ok) {
    const k = `${note.idx}>${answer}`;
    confusions[k] = (confusions[k] ?? 0) + 1;
  }
  return {
    ...m,
    notes: { ...m.notes, [note.id]: { box, seen: s.seen + 1, ok: s.ok + (ok ? 1 : 0), last: m.tick } },
    tick: m.tick + 1,
    recent: [...m.recent, ok].slice(-RECENT),
    confusions,
    lastPlayed: now,
  };
}

/** 3 estrelas com 9 ou 10 acertos, 2 com 7 ou 8, 1 nos outros casos */
export const stars = (correct: number): 1 | 2 | 3 => (correct >= 9 ? 3 : correct >= 7 ? 2 : 1);

/** a troca mais comum da rodada: [nota certa, nota respondida] (índices de NAMES) */
export function topConfusion(c: Record<string, number>): [number, number] | null {
  const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;
  const [a = 0, b = 0] = top[0].split(">").map(Number);
  return [a, b];
}

/** sequências que ganham comemoração */
export const isMilestone = (streak: number): boolean =>
  [5, 10, 20, 30].includes(streak) || (streak >= 50 && streak % 25 === 0);
