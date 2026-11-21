import { NOTE_COLORS } from "../../lib/games/notes";
import type { ChromaticPitch } from "../../lib/studies/scales";

/*
 * Medidas da pauta dos estudos (o padrão visual de todas as lições): uma semibreve por compasso,
 * todos os compassos da lição com a mesma largura, a do mais largo + um respiro dos dois lados.
 * Na cromática o mais largo é a alterada com as duas grafias (Lá♯ e Si♭, cada uma com o seu
 * acidente); nas escalas (acidentes na armadura) é uma nota sozinha.
 */
export const PAIR_MEASURE = 116;
export const SINGLE_MEASURE = 76;
/** distância entre as duas grafias do par */
const PAIR_GAP = 50;
// o par ocupa do acidente da 1ª (32 à esquerda da cabeça) até a borda da 2ª (13,5 à direita)
const PAIR_LEFT = 32;
const PAIR_RIGHT = 13.5;

/** a largura de compasso que cabe todas estas alturas */
export const measureFor = (pitches: ChromaticPitch[]) =>
  pitches.some((p) => p.spellings.length > 1) ? PAIR_MEASURE : SINGLE_MEASURE;

/** x da cabeça de cada grafia, a partir do começo do compasso (a natural fica no meio) */
export const headOffsets = (p: ChromaticPitch, measure: number) => {
  if (p.spellings.length === 1) return [measure / 2];
  const first = (measure - (PAIR_LEFT + PAIR_GAP + PAIR_RIGHT)) / 2 + PAIR_LEFT;
  return [first, first + PAIR_GAP];
};

/** a cor de cada nota no "Que nota é essa?" (Dó vermelho … Si roxo) */
export const colorOf = (letter: number) => NOTE_COLORS[letter]!;
