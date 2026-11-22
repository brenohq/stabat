/** geometria da pauta de uma linha do "Bate o ritmo" (unidades do viewBox), para a pauta e quem desenha por cima */
import { MEASURE } from "../../lib/games/rhythm/cells";
import { BRAVURA_SPACE } from "./bravura";

export const S = 15;
export const K = S / BRAVURA_SPACE;
export const INK = "#151515";
export const STAFF_OK = "#2f8a57";
export const STAFF_BAD = "#c0543c";
export const MUTED = "#8a8577";
export const RULE = "#d9d1c2";
export const WIDTH = 640;
export const X_START = 104;
export const X_END = 612;
export const TOP = 66;
export const LINE_H = 132;
export const STEM = 3.5 * S;
export const STEM_W = 0.12 * S;
export const BEAM = 0.5 * S;
export const RULER = 46;

export const lineY = (line: number) => TOP + line * LINE_H;
export const rulerY = (line: number) => lineY(line) + RULER;
export const xOf = (posInMeasure: number) => X_START + (posInMeasure / MEASURE) * (X_END - X_START);

/** ponto (em unidades do SVG) de uma posição em semicolcheias desde o começo; para o cursor e os toques */
export function staffPoint(
  pos: number,
  measures: number,
): { x: number; line: number; top: number; bottom: number } {
  const line = Math.max(0, Math.min(measures - 1, Math.floor(pos / MEASURE)));
  const x = Math.max(X_START - 14, Math.min(X_END + 4, xOf(pos - line * MEASURE)));
  return { x, line, top: lineY(line) - STEM - 10, bottom: rulerY(line) + 8 };
}
