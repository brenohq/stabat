/** Escalas de uma oitava, escritas com a armadura de clave (sem acidentes nas notas). */
import { noteFrom, parseNote, type Accidental, type WrittenNote } from "./notes";

export type Mode = "major" | "minor";

export interface KeySignature {
  /** 1 = sustenidos, -1 = bemóis, 0 = sem armadura */
  acc: Accidental;
  /** passo de cada acidente na pauta (0 = Mi4), na ordem em que se escrevem */
  steps: number[];
}

export interface Scale {
  /** "fa-maior" (igual em qualquer oitava) */
  id: string;
  /** "Fá maior" */
  label: string;
  mode: Mode;
  notes: WrittenNote[];
  signature: KeySignature;
}

/** menor = natural (por enquanto a única que as lições usam) */
const INTERVALS: Record<Mode, number[]> = {
  major: [2, 2, 1, 2, 2, 2, 1],
  minor: [2, 1, 2, 2, 1, 2, 2],
};

// clave de sol: Fá5 Dó5 Sol5 Ré5 Lá4 Mi5 Si4 · Si4 Mi5 Lá4 Ré5 Sol4 Dó5 Fá4
const SHARP_STEPS = [8, 5, 9, 6, 3, 7, 4];
const FLAT_STEPS = [4, 7, 3, 6, 2, 5, 1];
// quantos acidentes na armadura (positivo = sustenidos), pelo nome da tônica
const FIFTHS: Record<Mode, Record<string, number>> = {
  major: { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, "F#": 6, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5 },
  minor: { A: 0, E: 1, B: 2, "F#": 3, "C#": 4, D: -1, G: -2, C: -3, F: -4, Bb: -5 },
};

export function keySignature(tonic: string, mode: Mode): KeySignature {
  const n = FIFTHS[mode][tonic];
  if (n === undefined) throw new Error(`tonalidade sem armadura conhecida: ${tonic} ${mode}`);
  if (n === 0) return { acc: 0, steps: [] };
  return n > 0 ? { acc: 1, steps: SHARP_STEPS.slice(0, n) } : { acc: -1, steps: FLAT_STEPS.slice(0, -n) };
}

/** a escala subindo uma oitava a partir da tônica escrita ("F4"), soletrada nota a nota */
export function scaleNotes(tonicId: string, mode: Mode): WrittenNote[] {
  const tonic = parseNote(tonicId);
  const out = [tonic];
  let midi = tonic.midi;
  for (let i = 1; i <= 7; i++) {
    midi += INTERVALS[mode][i - 1]!;
    const letter = (tonic.letter + i) % 7;
    const octave = tonic.octave + Math.floor((tonic.letter + i) / 7);
    const natural = noteFrom(letter, 0, octave);
    const acc = midi - natural.midi;
    if (acc < -1 || acc > 1) throw new Error(`acidente duplo em ${tonicId} ${mode}`);
    out.push(noteFrom(letter, acc as Accidental, octave));
  }
  return out;
}

export function makeScale(tonicId: string, mode: Mode): Scale {
  const notes = scaleNotes(tonicId, mode);
  const tonic = notes[0]!;
  const name = tonic.name;
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace("♭", "-bemol")
    .replace("♯", "-sustenido")
    .toLowerCase();
  return {
    id: `${slug}-${mode === "major" ? "maior" : "menor"}`,
    label: `${name} ${mode === "major" ? "maior" : "menor"}`,
    mode,
    notes,
    signature: keySignature(tonic.id.replace(/\d$/, ""), mode),
  };
}

/** a ordem em que o exercício toca: sobe e desce (15 notas) */
export function upAndDown<T>(notes: T[]): T[] {
  return [...notes, ...notes.slice(0, -1).reverse()];
}

/**
 * A mesma escala na oitava que cabe na extensão do instrumento: a 4ª oitava quando cabe; senão uma
 * abaixo (tuba, sousafone) ou uma acima. null se não cabe em nenhuma.
 */
export function placeScale(scale: Scale, low: number, high: number): Scale | null {
  const tonic = scale.notes[0]!;
  for (const shift of [0, -1, 1]) {
    const notes = shift
      ? scaleNotes(noteFrom(tonic.letter, tonic.acc, tonic.octave + shift).id, scale.mode)
      : scale.notes;
    if (notes[0]!.midi >= low && notes.at(-1)!.midi <= high) return shift ? { ...scale, notes } : scale;
  }
  return null;
}

/** todas as notas de uma extensão, de semitom em semitom, escritas com sustenido (como se sobe) */
const SHARP_SPELLING: [letter: number, acc: Accidental][] = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
  [2, 0],
  [3, 0],
  [3, 1],
  [4, 0],
  [4, 1],
  [5, 0],
  [5, 1],
  [6, 0],
];
export function chromaticNotes(low: number, high: number): WrittenNote[] {
  const out: WrittenNote[] = [];
  for (let m = low; m <= high; m++) {
    const [letter, acc] = SHARP_SPELLING[m % 12]!;
    out.push(noteFrom(letter, acc, Math.floor(m / 12) - 1));
  }
  return out;
}

// as teclas pretas com bemol: Ré♭ Mi♭ Sol♭ Lá♭ Si♭
const FLAT_SPELLING: Record<number, [letter: number, acc: Accidental]> = {
  1: [1, -1],
  3: [2, -1],
  6: [4, -1],
  8: [5, -1],
  10: [6, -1],
};

/** uma altura da escala cromática com as grafias que ela tem: Lá♯ e Si♭, ou só Lá */
export interface ChromaticPitch {
  midi: number;
  /** a natural sozinha; a alterada com sustenido e bemol, nessa ordem */
  spellings: WrittenNote[];
}
export function chromaticPitches(low: number, high: number): ChromaticPitch[] {
  return chromaticNotes(low, high).map((sharp) => {
    const flat = FLAT_SPELLING[sharp.midi % 12];
    return {
      midi: sharp.midi,
      spellings: flat ? [sharp, noteFrom(flat[0], flat[1], sharp.octave)] : [sharp],
    };
  });
}
