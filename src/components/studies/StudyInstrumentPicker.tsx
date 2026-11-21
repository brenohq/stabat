import { PartPicker } from "../PartPicker";
import { STUDY_INSTRUMENTS, type StudyInstrument } from "../../lib/fingering/instruments";

// o seletor de parte do repertório, com os instrumentos dos estudos (inclui a flauta doce)
const OPTIONS = STUDY_INSTRUMENTS.map((i, index) => ({ id: i.id, name: i.name, index }));

export function StudyInstrumentPicker({
  value,
  onChange,
  label = "Seu instrumento",
  className = "",
}: {
  value: StudyInstrument;
  onChange: (id: string) => void;
  label?: string;
  className?: string;
}) {
  return (
    <PartPicker
      id="study-instrument"
      label={label}
      parts={OPTIONS}
      value={value.id}
      onChange={(id) => id && onChange(id)}
      placeholder="Escolher instrumento"
      className={className}
    />
  );
}
