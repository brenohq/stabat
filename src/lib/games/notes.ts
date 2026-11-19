/**
 * As 22 notas do "Que nota é essa?" (clave de sol), na ordem em que o jogo as apresenta.
 * Passo: 0 = 1ª linha da pauta (Mi4); cada passo é meia linha (linha → espaço → linha).
 */

export const NAMES = ["Dó", "Ré", "Mi", "Fá", "Sol", "Lá", "Si"] as const;
export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;
/** uma cor por nome de nota (como num xilofone infantil); a mesma no botão e na nota acertada */
export const NOTE_COLORS = ["#d64541", "#e8822a", "#d4a514", "#3f9d4f", "#22a09c", "#3b74cc", "#8a52c4"];

export type Level = 1 | 2 | 3;

export interface GameNote {
  /** notação científica (C4 = dó central) */
  id: string;
  step: number;
  level: Level;
  /** índice em NAMES/LETTERS: a resposta certa */
  idx: number;
  name: string;
  /** frequência da altura escrita, em Hz */
  freq: number;
  /** onde a nota fica, para a dica: "na 2ª linha" */
  place: string;
}

export const LEVEL_NAMES: Record<Level, string> = {
  1: "Dentro da pauta",
  2: "Saindo da pauta",
  3: "Linhas suplementares",
};

const ORDER: [id: string, step: number, level: Level][] = [
  // nível 1: dentro da pauta e o dó central
  ["G4", 2, 1],
  ["F4", 1, 1],
  ["A4", 3, 1],
  ["B4", 4, 1],
  ["D4", -1, 1],
  ["E4", 0, 1],
  ["C4", -2, 1],
  // nível 2: o alto da pauta e as primeiras suplementares de baixo
  ["C5", 5, 2],
  ["D5", 6, 2],
  ["E5", 7, 2],
  ["F5", 8, 2],
  ["G5", 9, 2],
  ["B3", -3, 2],
  ["A3", -4, 2],
  // nível 3: até 3 suplementares embaixo e 4 em cima
  ["G3", -5, 3],
  ["F3", -6, 3],
  ["A5", 10, 3],
  ["B5", 11, 3],
  ["C6", 12, 3],
  ["D6", 13, 3],
  ["E6", 14, 3],
  ["F6", 15, 3],
];

const ORDINAL = ["1ª", "2ª", "3ª", "4ª", "5ª"];
const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function placeOf(step: number): string {
  if (step >= 0 && step <= 8) {
    if (step % 2 === 0) return `na ${ORDINAL[step / 2]} linha`;
    return `no ${ORDINAL[(step - 1) / 2]!.replace("ª", "º")} espaço`;
  }
  if (step === -1) return "logo abaixo da pauta";
  if (step === 9) return "logo acima da pauta";
  const below = step < 0;
  const n = below ? Math.floor(-step / 2) : Math.floor((step - 8) / 2);
  const where = below ? "de baixo" : "de cima";
  if (step % 2 === 0) return `na ${n}ª linha suplementar ${where}`;
  return `${below ? "abaixo" : "acima"} da ${n}ª linha suplementar`;
}

export const NOTES: GameNote[] = ORDER.map(([id, step, level]) => {
  const letter = id.charAt(0);
  const idx = LETTERS.indexOf(letter as (typeof LETTERS)[number]);
  const midi = 12 * (Number(id.slice(1)) + 1) + SEMITONE[letter]!;
  return {
    id,
    step,
    level,
    idx,
    name: NAMES[idx]!,
    freq: 440 * 2 ** ((midi - 69) / 12),
    place: placeOf(step),
  };
});

const BY_ID = new Map(NOTES.map((n) => [n.id, n]));
export function noteById(id: string): GameNote {
  const n = BY_ID.get(id);
  if (!n) throw new Error(`nota desconhecida: ${id}`);
  return n;
}
