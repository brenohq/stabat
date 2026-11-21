import { useEffect, useRef } from "react";
import { CloseIcon } from "../icons";
import { FingeringDiagram } from "../fingering/FingeringDiagram";
import { describe } from "../../lib/fingering/describe";
import type { StudyInstrument } from "../../lib/fingering/instruments";
import type { Fingering } from "../../lib/fingering/tables";
import { pitchName, type WrittenNote } from "../../lib/studies/notes";
import { colorOf } from "./chromaticLayout";

/**
 * A digitação ampliada (celular: tocar no diagrama da faixa do topo). Mesmo <dialog> do imprimir:
 * Esc ou tocar fora fecha. Acompanha a nota da vez enquanto está aberto. Só é montado aberto (fechado,
 * não deixa um segundo diagrama na página).
 */
export function FingeringDialog({
  open,
  onClose,
  inst,
  note,
  alt,
  fingering,
}: {
  open: boolean;
  onClose: () => void;
  inst: StudyInstrument;
  note: WrittenNote;
  alt?: WrittenNote;
  fingering: Fingering;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  const m = inst.mechanism;
  const keys = m === "sax" || m === "clarinet" || m === "recorder";
  const names = [note, ...(alt ? [alt] : [])];
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()} // tocar fora fecha
      aria-labelledby="fingering-title"
      data-testid="fingering-dialog"
      className="m-auto max-h-[calc(100dvh-32px)] w-[440px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-[16px] border border-[#e8e0cf] bg-paper p-0 text-paper-ink shadow-card backdrop:bg-black/50"
    >
      <header className="flex items-start gap-3 px-5 pt-4">
        <div className="flex-1">
          <h2 id="fingering-title" className="flex flex-wrap items-baseline text-[28px] leading-tight">
            {names.map((n, i) => (
              <span key={n.id}>
                {i > 0 && <span className="mx-1.5 font-normal text-[#7a7466]">/</span>}
                <span style={{ color: colorOf(n.letter) }}>{n.name}</span>
              </span>
            ))}
            <small className="ml-0.5 text-base font-medium text-[#7a7466]">{note.octave}</small>
          </h2>
          <p className="text-[13px] text-[#7a7466]">
            {inst.name} · soa {pitchName(note.midi + inst.transpose)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="-mr-1.5 grid size-9 cursor-pointer place-items-center rounded-lg text-[#7a7466] hover:bg-black/5"
        >
          <CloseIcon className="size-5" />
        </button>
      </header>
      <div className="flex justify-center px-5 py-4">
        <div className={`w-full ${keys ? "max-w-[260px]" : ""}`}>
          <FingeringDiagram mechanism={m} fingering={fingering} />
        </div>
      </div>
      <p className="border-t border-[#e8e0cf] px-5 py-3.5 text-[17px] font-semibold text-[#1f2a44]">
        {describe(m, fingering)}
      </p>
    </dialog>
  );
}
