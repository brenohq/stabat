/**
 * Geometria da pauta do "Bate o ritmo" (unidades do viewBox), para a pauta e quem desenha por cima.
 * Pauta normal de cinco linhas em clave de sol, um compasso por linha; todas as notas no Lá (2º espaço).
 */
import { MEASURE } from "../../lib/games/rhythm/cells";
import { BRAVURA_SPACE } from "./bravura";

/** espaço da pauta */
export const S = 12;
export const K = S / BRAVURA_SPACE;
export const INK = "#151515";
export const STAFF_OK = "#2f8a57";
export const STAFF_BAD = "#c0543c";
export const MUTED = "#8a8577";
export const RULE = "#d9d1c2";
export const WIDTH = 640;
export const X_START = 112;
export const X_END = 612;
/** passo (0 = 1ª linha, Mi4; meia linha por passo) do Lá, a altura de todas as notas */
export const NOTE_STEP = 3;
/** 1ª linha do primeiro sistema e distância entre sistemas */
export const TOP = 96;
export const LINE_H = 150;
export const STEM = 3.5 * S;
export const STEM_W = 0.12 * S;
export const BEAM = 0.5 * S;
/** régua dos tempos, abaixo da 1ª linha */
export const RULER = 34;

/** y de um passo da pauta no sistema `line` */
export const stepY = (line: number, step: number) => TOP + line * LINE_H - step * (S / 2);
export const noteY = (line: number) => stepY(line, NOTE_STEP);
export const rulerY = (line: number) => stepY(line, 0) + RULER;
export const xOf = (posInMeasure: number) => X_START + (posInMeasure / MEASURE) * (X_END - X_START);

/** ponto (em unidades do SVG) de uma posição em semicolcheias desde o começo; para o cursor e os toques */
export function staffPoint(
  pos: number,
  measures: number,
): { x: number; line: number; top: number; bottom: number } {
  const line = Math.max(0, Math.min(measures - 1, Math.floor(pos / MEASURE)));
  const x = Math.max(X_START - 14, Math.min(X_END + 4, xOf(pos - line * MEASURE)));
  return { x, line, top: noteY(line) - STEM - 10, bottom: rulerY(line) + 8 };
}
