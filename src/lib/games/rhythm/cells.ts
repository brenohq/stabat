/**
 * Células rítmicas do "Bate o ritmo", na ordem em que o jogo as apresenta.
 *
 * Durações em semicolcheias (semínima = 4); negativo = pausa. Uma célula ocupa um ou mais tempos
 * inteiros de um compasso 4/4 e nunca passa para o compasso seguinte.
 */

export type RhythmLevel = 1 | 2 | 3 | 4 | 5;

/** onde a célula pode começar: em qualquer tempo, só no 1 ou no 3, ou só no 1 */
export type CellStart = "any" | "even" | "downbeat";

export interface Cell {
  id: string;
  durs: number[];
  level: RhythmLevel;
  start: CellStart;
  /** nome curto, para a apresentação */
  name: string;
  /** como contar/tocar, para a apresentação */
  how: string;
}

export const SIXTEENTHS_PER_BEAT = 4;
export const BEATS_PER_MEASURE = 4;
export const MEASURE = SIXTEENTHS_PER_BEAT * BEATS_PER_MEASURE;
/** cada exercício tem dois compassos 4/4 */
export const MEASURES = 2;

export const LEVEL_NAMES: Record<RhythmLevel, string> = {
  1: "Semínimas e mínimas",
  2: "Pausas",
  3: "Colcheias",
  4: "Ponto e contratempo",
  5: "Semicolcheias",
};

export const CELLS: Cell[] = [
  { id: "q", durs: [4], level: 1, start: "any", name: "Semínima", how: "Um toque, vale um tempo." },
  { id: "h", durs: [8], level: 1, start: "even", name: "Mínima", how: "Um toque, vale dois tempos." },
  {
    id: "w",
    durs: [16],
    level: 1,
    start: "downbeat",
    name: "Semibreve",
    how: "Um toque no 1, vale o compasso inteiro.",
  },
  {
    id: "hd",
    durs: [12],
    level: 1,
    start: "downbeat",
    name: "Mínima pontuada",
    how: "Um toque, vale três tempos: o ponto soma metade.",
  },
  {
    id: "rq",
    durs: [-4],
    level: 2,
    start: "any",
    name: "Pausa de semínima",
    how: "Um tempo de silêncio. Não toque.",
  },
  {
    id: "rh",
    durs: [-8],
    level: 2,
    start: "even",
    name: "Pausa de mínima",
    how: "Dois tempos de silêncio. Não toque.",
  },
  {
    id: "ee",
    durs: [2, 2],
    level: 3,
    start: "any",
    name: "Duas colcheias",
    how: "Dois toques no mesmo tempo: “1 e”.",
  },
  {
    id: "re",
    durs: [-2, 2],
    level: 4,
    start: "any",
    name: "Pausa de colcheia e colcheia",
    how: "Silêncio no tempo e um toque no “e”.",
  },
  {
    id: "qde",
    durs: [6, 2],
    level: 4,
    start: "even",
    name: "Semínima pontuada e colcheia",
    how: "Toque no 1 e no “e” do 2: “1 (2) e”.",
  },
  {
    id: "syn",
    durs: [2, 4, 2],
    level: 4,
    start: "even",
    name: "Síncope",
    how: "Colcheia, semínima, colcheia: toques no 1, no “e” e no “e” do 2.",
  },
  {
    id: "ssss",
    durs: [1, 1, 1, 1],
    level: 5,
    start: "any",
    name: "Quatro semicolcheias",
    how: "Quatro toques iguais num tempo: “1 e e e”… ou “ta-ca-ta-ca”.",
  },
  {
    id: "ess",
    durs: [2, 1, 1],
    level: 5,
    start: "any",
    name: "Colcheia e duas semicolcheias",
    how: "Um toque e dois rápidos: “ta ta-ca”.",
  },
  {
    id: "sse",
    durs: [1, 1, 2],
    level: 5,
    start: "any",
    name: "Duas semicolcheias e colcheia",
    how: "Dois rápidos e um toque: “ta-ca ta”.",
  },
];

export const cellById = (id: string): Cell => {
  const c = CELLS.find((x) => x.id === id);
  if (!c) throw new Error(`célula desconhecida: ${id}`);
  return c;
};

/** quantos tempos a célula ocupa */
export const beatsOf = (c: Cell): number => c.durs.reduce((a, d) => a + Math.abs(d), 0) / SIXTEENTHS_PER_BEAT;

/** a célula pode começar neste tempo (0–3) do compasso? */
export function fitsAt(c: Cell, beat: number): boolean {
  if (beat + beatsOf(c) > BEATS_PER_MEASURE) return false;
  if (c.start === "downbeat") return beat === 0;
  if (c.start === "even") return beat % 2 === 0;
  return true;
}
