import { useState } from "react";
import { BANDA } from "../lib/collections";
import {
  DEFAULT_STUDY_INSTRUMENT,
  studyInstrumentById,
  studyInstrumentForPart,
  type StudyInstrument,
} from "../lib/fingering/instruments";
import { myPartOf, studyInstrument } from "../lib/storage";

/** o instrumento dos estudos: o escolhido antes; senão o da "minha parte" da banda; senão a flauta doce */
export function initialStudyInstrument(): StudyInstrument {
  const saved = studyInstrumentById(studyInstrument.get());
  if (saved) return saved;
  const part = myPartOf(BANDA).get();
  return (part && studyInstrumentForPart(part.name)) || studyInstrumentById(DEFAULT_STUDY_INSTRUMENT)!;
}

export function useStudyInstrument() {
  const [inst, setInst] = useState(initialStudyInstrument);
  const choose = (id: string) => {
    const next = studyInstrumentById(id);
    if (!next) return;
    setInst(next);
    studyInstrument.set(id);
  };
  return [inst, choose] as const;
}
