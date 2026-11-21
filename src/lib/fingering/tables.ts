/**
 * Digitação pela nota escrita. Como as partes da banda estão todas em clave de sol e transpostas,
 * a mesma nota escrita tem a mesma digitação em todos os instrumentos de um mesmo mecanismo:
 * uma tabela de pistões serve para trompete, saxhorn, bombardino, tuba e sousafone.
 * Só a digitação principal (sem alternativas). A busca é pela altura (MIDI), então Lá♯ e Si♭ são
 * a mesma linha. Clarinete e flauta doce conferidos com o Woodwind Fingering Guide
 * (wfg.woodwind.org, tabelas "basic"); ainda vale a revisão de um professor.
 */
import { parseNote } from "../studies/notes";

export type Mechanism = "valves" | "slide" | "sax" | "clarinet" | "recorder";

export type Fingering =
  | { kind: "valves"; valves: number[] }
  | { kind: "slide"; position: number }
  | { kind: "keys"; keys: string[] };

/** chaves que cada diagrama desenha (o teste confere que as tabelas só usam estas) */
export const KEYS = {
  // pd/peb/pf = chaves de palma Ré/Mi♭/Fá; se = lateral do Mi agudo; gs/cs/lowb/lowbb = mesa do mínimo esquerdo
  sax: [
    "oct",
    "pd",
    "peb",
    "pf",
    "L1",
    "bis",
    "L2",
    "L3",
    "gs",
    "cs",
    "lowb",
    "lowbb",
    "R1",
    "R2",
    "R3",
    "se",
    "eb",
    "lowc",
  ],
  // gs = Sol♯ lateral; cs = Dó♯/Sol♯ e eb, fsc = mínimo esquerdo; fc, gsd = mínimo direito; s4 = lateral Mi♭/Si♭
  clarinet: [
    "reg",
    "T",
    "akey",
    "gs",
    "L1",
    "L2",
    "L3",
    "cs",
    "fsc",
    "eb",
    "R1",
    "R2",
    "R3",
    "s4",
    "fc",
    "gsd",
  ],
  // T = polegar fechado, Th = meio polegar; R3h/R4h = só o furo maior do par; bell = ponta tampada (na perna)
  recorder: ["T", "Th", "L1", "L2", "L3", "R1", "R2", "R3", "R3h", "R4", "R4h", "bell"],
} as const;

const split = (s: string) => s.split(" ").filter(Boolean);
/** { "C4": "..." } → Map(MIDI → chaves) */
const byPitch = <T>(table: Record<string, T>) =>
  new Map(Object.entries(table).map(([id, v]) => [parseNote(id).midi, v]));
const keyTable = (table: Record<string, string>) =>
  byPitch(Object.fromEntries(Object.entries(table).map(([id, v]) => [id, split(v)])));

/** clave de sol, de Fá♯3 a Dó6: vale para os cinco metais de pistão (cada um usa a sua extensão) */
export const VALVES = byPitch<number[]>({
  "F#3": [1, 2, 3],
  G3: [1, 3],
  "G#3": [2, 3],
  A3: [1, 2],
  "A#3": [1],
  B3: [2],
  C4: [],
  "C#4": [1, 2, 3],
  D4: [1, 3],
  "D#4": [2, 3],
  E4: [1, 2],
  F4: [1],
  "F#4": [2],
  G4: [],
  "G#4": [2, 3],
  A4: [1, 2],
  "A#4": [1],
  B4: [2],
  C5: [],
  "C#5": [1, 2],
  D5: [1],
  "D#5": [2],
  E5: [],
  F5: [1],
  "F#5": [2],
  G5: [],
  "G#5": [2, 3],
  A5: [1, 2],
  "A#5": [1],
  B5: [2],
  C6: [],
});

/** vara: cada combinação de pistões abaixa a série do mesmo tanto que uma posição */
const POSITION: Record<string, number> = {
  "": 1,
  "2": 2,
  "1": 3,
  "1,2": 4,
  "3": 4,
  "2,3": 5,
  "1,3": 6,
  "1,2,3": 7,
};
export const slidePosition = (valves: number[]) => POSITION[[...valves].sort().join(",")]!;

/** sax alto e tenor (mesma digitação pela nota escrita), Si♭3 a Fá6 */
export const SAX = keyTable({
  "A#3": "L1 L2 L3 R1 R2 R3 lowbb",
  B3: "L1 L2 L3 R1 R2 R3 lowb",
  C4: "L1 L2 L3 R1 R2 R3 lowc",
  "C#4": "L1 L2 L3 R1 R2 R3 cs",
  D4: "L1 L2 L3 R1 R2 R3",
  "D#4": "L1 L2 L3 R1 R2 R3 eb",
  E4: "L1 L2 L3 R1 R2",
  F4: "L1 L2 L3 R1",
  "F#4": "L1 L2 L3 R2",
  G4: "L1 L2 L3",
  "G#4": "L1 L2 L3 gs",
  A4: "L1 L2",
  "A#4": "L1 bis",
  B4: "L1",
  C5: "L2",
  "C#5": "",
  D5: "oct L1 L2 L3 R1 R2 R3",
  "D#5": "oct L1 L2 L3 R1 R2 R3 eb",
  E5: "oct L1 L2 L3 R1 R2",
  F5: "oct L1 L2 L3 R1",
  "F#5": "oct L1 L2 L3 R2",
  G5: "oct L1 L2 L3",
  "G#5": "oct L1 L2 L3 gs",
  A5: "oct L1 L2",
  "A#5": "oct L1 bis",
  B5: "oct L1",
  C6: "oct L2",
  "C#6": "oct",
  D6: "oct pd",
  "D#6": "oct pd peb",
  E6: "oct pd peb se",
  F6: "oct pd peb pf",
});

/** clarinete Boehm, Mi3 a Dó6 (chalumeau e clarim) */
export const CLARINET = keyTable({
  E3: "T L1 L2 L3 R1 R2 R3 eb",
  F3: "T L1 L2 L3 R1 R2 R3 fc",
  "F#3": "T L1 L2 L3 R1 R2 R3 fsc",
  G3: "T L1 L2 L3 R1 R2 R3",
  "G#3": "T L1 L2 L3 R1 R2 R3 gsd",
  A3: "T L1 L2 L3 R1 R2",
  "A#3": "T L1 L2 L3 R1",
  B3: "T L1 L2 L3 R2",
  C4: "T L1 L2 L3",
  "C#4": "T L1 L2 L3 cs",
  D4: "T L1 L2",
  "D#4": "T L1 L2 s4",
  E4: "T L1",
  F4: "T",
  "F#4": "L1",
  G4: "",
  "G#4": "gs",
  A4: "akey",
  "A#4": "reg akey",
  B4: "reg T L1 L2 L3 R1 R2 R3 eb",
  C5: "reg T L1 L2 L3 R1 R2 R3 fc",
  "C#5": "reg T L1 L2 L3 R1 R2 R3 fsc",
  D5: "reg T L1 L2 L3 R1 R2 R3",
  "D#5": "reg T L1 L2 L3 R1 R2 R3 gsd",
  E5: "reg T L1 L2 L3 R1 R2",
  F5: "reg T L1 L2 L3 R1",
  "F#5": "reg T L1 L2 L3 R2",
  G5: "reg T L1 L2 L3",
  "G#5": "reg T L1 L2 L3 cs",
  A5: "reg T L1 L2",
  "A#5": "reg T L1 L2 s4",
  B5: "reg T L1",
  C6: "reg T",
});

/** flauta doce soprano, dedilhado barroco (inglês), Dó4 a Ré6 escritos (soa uma oitava acima) */
export const RECORDER = keyTable({
  C4: "T L1 L2 L3 R1 R2 R3 R4",
  "C#4": "T L1 L2 L3 R1 R2 R3 R4h",
  D4: "T L1 L2 L3 R1 R2 R3",
  "D#4": "T L1 L2 L3 R1 R2 R3h",
  E4: "T L1 L2 L3 R1 R2",
  F4: "T L1 L2 L3 R1 R3 R4",
  "F#4": "T L1 L2 L3 R2 R3",
  G4: "T L1 L2 L3",
  "G#4": "T L1 L2 R1 R2 R3h",
  A4: "T L1 L2",
  "A#4": "T L1 L3 R1",
  B4: "T L1",
  C5: "T L2",
  "C#5": "L1 L2",
  D5: "L2",
  "D#5": "L2 L3 R1 R2 R3",
  E5: "Th L1 L2 L3 R1 R2",
  F5: "Th L1 L2 L3 R1 R3",
  "F#5": "Th L1 L2 L3 R2",
  G5: "Th L1 L2 L3",
  "G#5": "Th L1 L2 R1",
  A5: "Th L1 L2",
  "A#5": "Th L1 L2 R1 R2 R3",
  B5: "Th L1 L2 R1 R2",
  C6: "Th L1 R1 R2",
  "C#6": "Th L1 L3 R1 R3 bell",
  D6: "Th L1 L3 R1 R3",
});

const KEY_TABLES = { sax: SAX, clarinet: CLARINET, recorder: RECORDER };

/** digitação de uma nota escrita ("Bb4" ou "A#4"), ou null se a tabela não tem a nota */
export function fingeringFor(mechanism: Mechanism, noteId: string): Fingering | null {
  const midi = parseNote(noteId).midi;
  if (mechanism === "valves" || mechanism === "slide") {
    const v = VALVES.get(midi);
    if (!v) return null;
    return mechanism === "valves"
      ? { kind: "valves", valves: v }
      : { kind: "slide", position: slidePosition(v) };
  }
  const keys = KEY_TABLES[mechanism].get(midi);
  return keys ? { kind: "keys", keys } : null;
}
