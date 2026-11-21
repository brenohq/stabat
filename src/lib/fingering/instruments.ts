/** Instrumentos dos estudos: os da banda e a flauta doce dos novatos. */
import { instrumentOf } from "../parts";
import { parseNote } from "../studies/notes";
import type { Mechanism } from "./tables";

export type StudyGroup = "Madeiras" | "Metais agudos" | "Metais graves";

export interface StudyInstrument {
  id: string;
  name: string;
  mechanism: Mechanism;
  /** semitons da nota escrita até o som (Sib: −2; flauta doce soprano: +12) */
  transpose: number;
  group: StudyGroup;
  /** extensão usual, em notas escritas: é o que a escala cromática mostra */
  range: [low: string, high: string];
}

export const STUDY_INSTRUMENTS: StudyInstrument[] = [
  {
    id: "flauta-doce",
    name: "Flauta doce",
    mechanism: "recorder",
    transpose: 12,
    group: "Madeiras",
    range: ["C4", "D6"],
  },
  {
    id: "clarinete",
    name: "Clarinete Sib",
    mechanism: "clarinet",
    transpose: -2,
    group: "Madeiras",
    range: ["E3", "C6"],
  },
  {
    id: "sax-alto",
    name: "Sax Alto Mib",
    mechanism: "sax",
    transpose: -9,
    group: "Madeiras",
    range: ["A#3", "F6"],
  },
  {
    id: "sax-tenor",
    name: "Sax Tenor Sib",
    mechanism: "sax",
    transpose: -14,
    group: "Madeiras",
    range: ["A#3", "F6"],
  },
  {
    id: "trompete",
    name: "Trompete Sib",
    mechanism: "valves",
    transpose: -2,
    group: "Metais agudos",
    range: ["F#3", "C6"],
  },
  {
    id: "saxhorn",
    name: "Saxhorn Mib",
    mechanism: "valves",
    transpose: -9,
    group: "Metais agudos",
    range: ["F#3", "C6"],
  },
  {
    id: "trombone",
    name: "Trombone Sib",
    mechanism: "slide",
    transpose: -14,
    group: "Metais graves",
    range: ["F#3", "C6"],
  },
  {
    id: "bombardino",
    name: "Bombardino Sib",
    mechanism: "valves",
    transpose: -14,
    group: "Metais graves",
    range: ["F#3", "C6"],
  },
  {
    id: "tuba",
    name: "Tuba Mib",
    mechanism: "valves",
    transpose: -33,
    group: "Metais graves",
    range: ["F#3", "G5"],
  },
  {
    id: "sousafone",
    name: "Sousafone Sib",
    mechanism: "valves",
    transpose: -26,
    group: "Metais graves",
    range: ["F#3", "G5"],
  },
];

export const DEFAULT_STUDY_INSTRUMENT = "flauta-doce";

export const studyInstrumentById = (id: string | null | undefined) =>
  STUDY_INSTRUMENTS.find((i) => i.id === id);

/** a parte da banda ("Sax Tenor Sib 2") → o instrumento dos estudos ("sax-tenor") */
export function studyInstrumentForPart(partName: string): StudyInstrument | undefined {
  const kind = instrumentOf(partName);
  const id =
    kind === "sax"
      ? /tenor/i.test(partName)
        ? "sax-tenor"
        : "sax-alto"
      : kind &&
        {
          recorder: "flauta-doce",
          clarinet: "clarinete",
          trumpet: "trompete",
          saxhorn: "saxhorn",
          trombone: "trombone",
          euphonium: "bombardino",
          tuba: "tuba",
          sousaphone: "sousafone",
        }[kind];
  return studyInstrumentById(id);
}

/** a extensão do instrumento em MIDI (notas escritas) */
export const rangeOf = (inst: StudyInstrument): [number, number] => [
  parseNote(inst.range[0]).midi,
  parseNote(inst.range[1]).midi,
];
