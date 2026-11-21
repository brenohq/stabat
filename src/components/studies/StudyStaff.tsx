import { useEffect, useRef } from "react";
import { NoteStaff, SIGNATURE_STEP, SIGNATURE_X } from "../games/NoteStaff";
import { staffGeometry } from "../games/staffGeometry";
import { FingeringDiagram } from "../fingering/FingeringDiagram";
import { fingeringFor, type Mechanism } from "../../lib/fingering/tables";
import type { ChromaticPitch, KeySignature } from "../../lib/studies/scales";
import { colorOf, headOffsets } from "./chromaticLayout";

const S = 16;
const RIGHT = 12;

const barOf = (p: ChromaticPitch) =>
  p.spellings.length > 1
    ? `linear-gradient(90deg, ${colorOf(p.spellings[0]!.letter)} 50%, ${colorOf(p.spellings[1]!.letter)} 50%)`
    : colorOf(p.spellings[0]!.letter);

/**
 * Uma linha de pauta dos estudos, o padrão visual de todas as lições:
 * - uma semibreve por compasso, todos os compassos com a mesma largura, barra depois de cada altura
 *   e barra dupla final na última linha (a pauta termina na última barra);
 * - escalas com armadura (lugar reservado para a maior armadura da lição: trocar de escala não mexe
 *   a pauta); na cromática, o acidente vai na nota e a alterada aparece com as duas grafias
 *   lado a lado (Lá♯ e Si♭) no mesmo compasso;
 * - as cores do "Que nota é essa?": barra na cor da letra sob cada nome e a nota da vez acesa na
 *   cor dela;
 * - embaixo de cada compasso, o botão com o nome e a miniatura da digitação (do sm para cima; no
 *   celular fica só o nome).
 */
export function StudyStaff({
  row,
  measure,
  contentWidth,
  signature,
  signatureSlots = 0,
  accidentals,
  frame,
  last,
  mechanism,
  current,
  onSelect,
  label,
  follow,
}: {
  row: ChromaticPitch[];
  /** largura de cada compasso (igual na lição inteira) */
  measure: number;
  /** a largura da linha cheia: todas as linhas alinham pela esquerda com a mesma escala */
  contentWidth: number;
  signature?: KeySignature;
  /** quantos acidentes de armadura cabem antes da primeira nota (a maior armadura da lição) */
  signatureSlots?: number;
  /** escreve o sustenido/bemol na própria nota (cromática) */
  accidentals?: boolean;
  /** passo mais alto e mais baixo da lição inteira (a pauta não muda de altura ao trocar de escala) */
  frame?: { top: number; bottom: number };
  last?: boolean;
  mechanism: Mechanism;
  /** índice da altura da vez nesta linha, ou -1 */
  current: number;
  onSelect: (i: number) => void;
  label: string;
  /** rola a tela até a nota da vez quando ela muda (durante o play) */
  follow?: boolean;
}) {
  const left = S * (SIGNATURE_X + signatureSlots * SIGNATURE_STEP) + 10;
  const width = left + contentWidth + RIGHT;
  const steps = row.flatMap((p) => p.spellings.map((n) => n.step));
  const geo = staffGeometry({
    s: S,
    top: frame?.top ?? Math.max(10, ...steps.map((s) => s + 2)),
    bottom: frame?.bottom ?? Math.min(-2, ...steps.map((s) => s - 2)),
    margin: 10,
    width,
  });
  const starts = row.map((_, i) => left + i * measure);
  const heads = row.flatMap((p, i) =>
    p.spellings.map((n, j) => ({ n, i, x: starts[i]! + headOffsets(p, measure)[j]! })),
  );
  const end = left + row.length * measure;
  const line = Math.max(1, S / 14);
  const pct = (v: number) => `${(v / width) * 100}%`;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (follow && current >= 0)
      buttons.current[current]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [follow, current]);

  return (
    <div className="mx-auto w-full max-w-[860px]">
      <NoteStaff
        geo={geo}
        xs={heads.map((h) => h.x)}
        label={label}
        signature={signature}
        notes={heads.map((h) => ({
          step: h.n.step,
          acc: accidentals ? h.n.acc : 0,
          color: h.i === current ? colorOf(h.n.letter) : undefined,
        }))}
        staffEnd={end}
        underlay={row.map((p, i) => (
          <rect
            key={p.midi}
            x={starts[i]! + 2}
            y={2}
            width={measure - 4}
            height={geo.height - 4}
            rx={8}
            fill={i === current ? `${colorOf(p.spellings[0]!.letter)}1c` : "transparent"}
            className="cursor-pointer"
            onClick={() => onSelect(i)}
          />
        ))}
      >
        <g stroke="#151515">
          {row.map((_, i) => {
            const bx = starts[i]! + measure;
            return last && i === row.length - 1 ? (
              <g key={i} data-testid="final-barline">
                <line x1={bx - 5} x2={bx - 5} y1={geo.y(8)} y2={geo.y(0)} strokeWidth={line} />
                <line x1={bx - 1.5} x2={bx - 1.5} y1={geo.y(8)} y2={geo.y(0)} strokeWidth={3} />
              </g>
            ) : (
              <line
                key={i}
                data-testid="barline"
                x1={bx}
                x2={bx}
                y1={geo.y(8)}
                y2={geo.y(0)}
                strokeWidth={line}
              />
            );
          })}
        </g>
      </NoteStaff>
      <div
        className="grid"
        style={{
          paddingLeft: pct(left),
          paddingRight: pct(RIGHT + contentWidth - row.length * measure),
          gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
        }}
      >
        {row.map((p, i) => {
          const f = fingeringFor(mechanism, p.spellings[0]!.id);
          const on = i === current;
          return (
            <button
              key={p.midi}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              data-testid="scale-note"
              data-note={p.spellings[0]!.id}
              aria-pressed={on}
              aria-label={`${p.spellings.map((n) => n.name).join(" ou ")}${p.spellings[0]!.octave}`}
              onClick={() => onSelect(i)}
              className={`mx-[2px] flex min-w-0 flex-col items-center gap-1 rounded-lg pt-1 pb-2 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                on ? "bg-[rgb(31_42_68/.08)] text-[#1f2a44]" : "text-[#5b6070] hover:bg-[rgb(31_42_68/.04)]"
              }`}
            >
              <span
                className={`flex max-w-full flex-wrap content-end justify-center leading-tight ${
                  p.spellings.length > 1 || row.some((x) => x.spellings.length > 1)
                    ? "min-h-[2.5em] sm:min-h-0"
                    : ""
                }`}
              >
                {p.spellings.map((n, j) => (
                  <span key={n.id}>
                    {n.name}
                    {j < p.spellings.length - 1 && "/"}
                  </span>
                ))}
              </span>
              <span
                aria-hidden
                className={`h-[3px] rounded-full ${on ? "w-4/5" : "w-3/5"}`}
                style={{ background: barOf(p) }}
              />
              {f && (
                <span
                  className={`mt-1 hidden w-full sm:block ${
                    mechanism === "slide"
                      ? "max-w-[30px]"
                      : mechanism === "valves"
                        ? "max-w-[46px]"
                        : "max-w-[32px]"
                  }`}
                >
                  <FingeringDiagram mechanism={mechanism} fingering={f} mini />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
