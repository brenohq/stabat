import { useState } from "react";
import { FingeringDiagram } from "../fingering/FingeringDiagram";
import { FingeringDialog } from "./FingeringDialog";
import { changes, describe } from "../../lib/fingering/describe";
import type { StudyInstrument } from "../../lib/fingering/instruments";
import { fingeringFor } from "../../lib/fingering/tables";
import { pitchName, type WrittenNote } from "../../lib/studies/notes";
import { colorOf } from "./chromaticLayout";

const INK = "#1f2a44";
const MUTED = "#7a7466";

/**
 * A nota da vez: o diagrama grande e a leitura (nome, "soa como", digitação, o que muda).
 * `layout`: "wide" = diagrama e texto lado a lado (escalas); "side" = coluna estreita (cromática no
 * computador); "compact" = faixa baixa, fixa no topo da tela (cromática no celular).
 */
export function NoteDetail({
  inst,
  note,
  alt,
  prev,
  layout = "wide",
  colored,
}: {
  inst: StudyInstrument;
  note: WrittenNote;
  /** a outra grafia da mesma altura (Si♭ de Lá♯), mostrada ao lado: "Lá♯ / Si♭" */
  alt?: WrittenNote;
  prev: WrittenNote | null;
  layout?: "wide" | "side" | "compact";
  /** nome na cor de cada nota (paleta do jogo) */
  colored?: boolean;
}) {
  const m = inst.mechanism;
  const f = fingeringFor(m, note.id);
  const pf = prev ? fingeringFor(m, prev.id) : null;
  const keys = m === "sax" || m === "clarinet" || m === "recorder";
  const width =
    layout === "compact"
      ? keys
        ? "w-[70px]"
        : m === "slide"
          ? "w-[150px]"
          : "w-[128px]"
      : keys
        ? "max-w-[210px]"
        : m === "slide"
          ? "max-w-[460px]"
          : "max-w-[400px]";
  const grid =
    layout === "wide"
      ? "grid items-center gap-x-8 gap-y-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
      : layout === "side"
        ? "flex flex-col gap-4"
        : "flex items-center gap-4";
  const compact = layout === "compact";
  // celular: o diagrama do topo é pequeno; tocar nele abre a digitação ampliada
  const [zoomed, setZoomed] = useState(false);
  return (
    <div className={grid}>
      <div
        className={`flex items-center justify-center ${layout === "compact" ? "flex-none" : "min-h-[200px]"}`}
        data-testid="fingering"
        data-mechanism={m}
      >
        {compact && f ? (
          <button
            type="button"
            onClick={() => setZoomed(true)}
            aria-label="Ver a digitação ampliada"
            data-testid="fingering-zoom"
            className={`${width} cursor-zoom-in rounded-lg p-0.5 transition active:scale-95`}
          >
            <FingeringDiagram mechanism={m} fingering={f} />
          </button>
        ) : (
          <div className={compact ? width : `w-full ${width}`}>
            {f && <FingeringDiagram mechanism={m} fingering={f} />}
          </div>
        )}
      </div>
      {compact && f && zoomed && (
        <FingeringDialog
          open
          onClose={() => setZoomed(false)}
          inst={inst}
          note={note}
          alt={alt}
          fingering={f}
        />
      )}
      {/* compacto (preso no topo, no celular): linhas de altura fixa, para a faixa não mudar de altura
          de uma nota para outra (o nome numa linha só; a digitação sempre com lugar para duas) */}
      <div className={`flex min-w-0 flex-col ${compact ? "flex-1 gap-1.5" : "gap-2"}`} aria-live="polite">
        <div
          className={`flex items-baseline font-display leading-none font-semibold ${
            compact ? "overflow-hidden text-[24px] whitespace-nowrap" : "flex-wrap gap-y-1 text-[40px]"
          }`}
          data-testid="study-note"
        >
          {[note, ...(alt ? [alt] : [])].map((n, i) => (
            <span key={n.id}>
              {i > 0 && (
                <span className="mx-1.5 font-normal" style={{ color: MUTED }}>
                  /
                </span>
              )}
              <span style={colored ? { color: colorOf(n.letter) } : undefined}>{n.name}</span>
            </span>
          ))}
          <small className="ml-0.5 text-lg font-medium" style={{ color: MUTED }}>
            {note.octave}
          </small>
        </div>
        <div className={`text-sm ${compact ? "truncate" : ""}`} style={{ color: MUTED }}>
          {compact ? "" : `nota escrita · ${inst.name} · `}soa {pitchName(note.midi + inst.transpose)}
        </div>
        {f && (
          <div
            className={`font-semibold ${compact ? "line-clamp-2 min-h-[2.7em] text-[15px] leading-[1.35]" : "text-[17px]"}`}
            style={{ color: INK }}
            data-testid="study-fingering"
          >
            {describe(m, f)}
          </div>
        )}
        {f && layout !== "compact" && (
          <div className="min-h-5 text-sm" style={{ color: MUTED }}>
            {changes(m, pf, f)}
          </div>
        )}
        {layout !== "compact" && <Legend inst={inst} />}
      </div>
    </div>
  );
}

function Legend({ inst }: { inst: StudyInstrument }) {
  const m = inst.mechanism;
  return (
    <div
      className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-[#e8e0cf] pt-2.5 text-[12.5px]"
      style={{ color: MUTED }}
    >
      <Dot fill={INK} stroke={INK}>
        {m === "slide" ? "posição da mão" : "apertado"}
      </Dot>
      {m !== "slide" && (
        <Dot fill="#fffdf8" stroke={INK}>
          solto
        </Dot>
      )}
      {(m === "sax" || m === "clarinet") && (
        <Dot fill="#fffdf8" stroke="#cfc7b6">
          não usada nestas lições
        </Dot>
      )}
      {m === "recorder" && <Dot half>meio polegar</Dot>}
    </div>
  );
}

function Dot({
  fill,
  stroke,
  half,
  children,
}: {
  fill?: string;
  stroke?: string;
  half?: boolean;
  children: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg viewBox="0 0 14 14" className="size-3.5" aria-hidden>
        <circle
          cx={7}
          cy={7}
          r={5.5}
          fill={half ? "#fffdf8" : fill}
          stroke={half ? INK : stroke}
          strokeWidth={1.5}
        />
        {half && <path d="M7 1.5A5.5 5.5 0 0 0 7 12.5Z" fill={INK} />}
      </svg>
      {children}
    </span>
  );
}
