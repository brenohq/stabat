import type { ReactNode } from "react";
import type { StaffGeometry } from "./staffGeometry";
import { BRAVURA_SPACE, CLEF, FLAT, SHARP, WHOLE, WHOLE_WIDTH } from "./bravura";

/*
 * Pauta em clave de sol desenhada em SVG próprio (sem Verovio): é pouca coisa, anima e abre na hora.
 * Clave e semibreve são os glifos E050 e E0A2 da fonte Bravura (SIL Open Font License), copiados
 * do SVG do Verovio. Nas unidades da Bravura, 1 espaço da pauta = 250; a origem da clave é a linha
 * do Sol e a da semibreve é a borda esquerda, no meio da altura. O "furo" da semibreve é vazado:
 * colorir o `fill` pinta só a parte preta.
 */
/** x onde começa a armadura e quanto cada acidente ocupa (em espaços da pauta) */
export const SIGNATURE_X = 3.9;
export const SIGNATURE_STEP = 1.05;
const INK = "#151515";

export interface StaffNote {
  /** passo: 0 = 1ª linha (Mi4), meia linha por passo */
  step: number;
  /** acidente escrito na própria nota (1 = sustenido, -1 = bemol) */
  acc?: -1 | 0 | 1;
  color?: string;
  /** muda a chave do elemento → a animação de entrada roda de novo */
  key?: string | number;
  className?: string;
}

export function NoteStaff({
  geo,
  notes,
  xs,
  label,
  signature,
  underlay,
  staffEnd,
  children,
}: {
  geo: StaffGeometry;
  notes: StaffNote[];
  /** centro horizontal de cada nota */
  xs: number[];
  label: string;
  /** armadura de clave: 1 = sustenidos, -1 = bemóis; passos de cada acidente */
  signature?: { acc: -1 | 0 | 1; steps: number[] };
  /** desenhado antes das notas (ex.: o destaque da nota da vez) */
  underlay?: ReactNode;
  /** onde as linhas da pauta terminam (padrão: a largura toda) */
  staffEnd?: number;
  children?: ReactNode;
}) {
  const { s, width, height, y } = geo;
  const k = s / BRAVURA_SPACE;
  const line = Math.max(1, s / 14);
  const head = WHOLE_WIDTH * k;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="block h-auto w-full">
      <g stroke={INK} strokeWidth={line}>
        {[0, 2, 4, 6, 8].map((st) => (
          <line key={st} x1={4} x2={staffEnd ?? width - 4} y1={y(st)} y2={y(st)} />
        ))}
      </g>
      {underlay}
      <path d={CLEF} fill={INK} transform={`translate(${s * 0.75} ${y(2)}) scale(${k} ${-k})`} />
      {signature?.steps.map((st, i) => (
        <path
          key={i}
          d={signature.acc > 0 ? SHARP : FLAT}
          fill={INK}
          data-testid="key-signature"
          transform={`translate(${s * (SIGNATURE_X + i * SIGNATURE_STEP)} ${y(st)}) scale(${k} ${-k})`}
        />
      ))}
      {notes.map((n, i) => {
        const x = xs[i] ?? width / 2;
        const ledgers: number[] = [];
        for (let st = -2; st >= n.step; st -= 2) ledgers.push(st);
        for (let st = 10; st <= n.step; st += 2) ledgers.push(st);
        return (
          <g key={n.key ?? i} className={n.className} style={{ transformOrigin: `${x}px ${y(n.step)}px` }}>
            {ledgers.map((st) => (
              <line
                key={st}
                x1={x - head / 2 - s * 0.4}
                x2={x + head / 2 + s * 0.4}
                y1={y(st)}
                y2={y(st)}
                stroke={INK}
                strokeWidth={line}
              />
            ))}
            {n.acc ? (
              <path
                d={n.acc > 0 ? SHARP : FLAT}
                fill={n.color ?? INK}
                data-testid="note-accidental"
                transform={`translate(${x - head / 2 - s * 1.15} ${y(n.step)}) scale(${k} ${-k})`}
              />
            ) : null}
            <path
              d={WHOLE}
              fill={n.color ?? INK}
              style={{ transition: "fill .2s" }}
              transform={`translate(${x - head / 2} ${y(n.step)}) scale(${k} ${-k})`}
              data-testid="notehead"
            />
          </g>
        );
      })}
      {children}
    </svg>
  );
}
