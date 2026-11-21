/**
 * Notas escritas dos estudos (clave de sol). "C4" = dó central, "Bb4", "F#5".
 * Passo na pauta como no jogo: 0 = 1ª linha (Mi4), meia linha por passo.
 */
import { NAMES } from "../games/notes";

const LETTERS = "CDEFGAB";
const SEMI = [0, 2, 4, 5, 7, 9, 11];

export type Accidental = -1 | 0 | 1;

export interface WrittenNote {
  /** notação científica: "Bb4" */
  id: string;
  /** índice da letra (0 = Dó … 6 = Si) */
  letter: number;
  acc: Accidental;
  octave: number;
  /** MIDI da altura escrita */
  midi: number;
  step: number;
  /** "Si♭" */
  name: string;
}

const accSign = (acc: Accidental) => (acc > 0 ? "♯" : acc < 0 ? "♭" : "");

export function noteFrom(letter: number, acc: Accidental, octave: number): WrittenNote {
  const id = `${LETTERS[letter]}${acc > 0 ? "#" : acc < 0 ? "b" : ""}${octave}`;
  return {
    id,
    letter,
    acc,
    octave,
    midi: 12 * (octave + 1) + SEMI[letter]! + acc,
    step: (octave - 4) * 7 + letter - 2,
    name: NAMES[letter] + accSign(acc),
  };
}

export function parseNote(id: string): WrittenNote {
  const m = /^([A-G])(#|b)?(\d)$/.exec(id);
  if (!m) throw new Error(`nota inválida: ${id}`);
  return noteFrom(LETTERS.indexOf(m[1]!), m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0, Number(m[3]));
}

/** nome da altura real (o "soa como"), com bemóis, menos o Fá♯: "Si♭3" */
const CHROMATIC = ["Dó", "Ré♭", "Ré", "Mi♭", "Mi", "Fá", "Fá♯", "Sol", "Lá♭", "Lá", "Si♭", "Si"];
export function pitchName(midi: number): string {
  return `${CHROMATIC[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
