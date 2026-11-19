import type { ReactNode } from "react";
import type { StaffGeometry } from "./staffGeometry";

/*
 * Pauta em clave de sol desenhada em SVG próprio (sem Verovio): é pouca coisa, anima e abre na hora.
 * Clave e semibreve são os glifos E050 e E0A2 da fonte Bravura (SIL Open Font License), copiados
 * do SVG do Verovio. Nas unidades da Bravura, 1 espaço da pauta = 250; a origem da clave é a linha
 * do Sol e a da semibreve é a borda esquerda, no meio da altura. O "furo" da semibreve é vazado:
 * colorir o `fill` pinta só a parte preta.
 */
const CLEF =
  "M376 415l25 -145c3 -18 3 -18 29 -18c147 0 241 -113 241 -241c0 -113 -67 -198 -168 -238c-14 -6 -15 -5 -13 -17c11 -62 29 -157 29 -214c0 -170 -130 -200 -197 -200c-151 0 -190 98 -190 163c0 62 40 115 107 115c61 0 96 -47 96 -102c0 -58 -36 -85 -67 -94c-23 -7 -32 -10 -32 -17c0 -13 26 -29 80 -29c59 0 159 18 159 166c0 47 -15 134 -27 201c-2 12 -4 11 -15 9c-20 -4 -46 -6 -69 -6c-245 0 -364 165 -364 339c0 202 153 345 297 464c12 10 11 12 9 24c-7 41 -14 106 -14 164c0 104 24 229 98 311c20 22 51 48 65 48c11 0 37 -28 52 -50c41 -60 65 -146 65 -233c0 -153 -82 -280 -190 -381c-6 -6 -8 -7 -6 -19zM470 943c-61 0 -133 -96 -133 -252c0 -32 2 -66 6 -92c2 -13 6 -14 13 -8c79 69 174 159 174 270c0 55 -27 82 -60 82zM361 262l-21 128c-2 11 -4 12 -14 4c-47 -38 -93 -75 -153 -142c-83 -94 -93 -173 -93 -232c0 -139 113 -236 288 -236c20 0 40 2 56 5c15 3 16 3 14 14l-50 298c-2 11 -4 12 -20 8c-61 -17 -100 -60 -100 -117c0 -46 30 -89 72 -107c7 -3 15 -6 15 -13c0 -6 -4 -11 -12 -11c-7 0 -19 3 -27 6c-68 23 -115 87 -115 177c0 85 57 164 145 194c18 6 18 5 15 24zM430 103l49 -285c2 -12 4 -12 16 -6c56 28 94 79 94 142c0 88 -67 156 -148 163c-12 1 -13 -2 -11 -14z";
const WHOLE =
  "M216 125c93 0 206 -52 206 -123c0 -70 -52 -127 -216 -127c-149 0 -206 60 -206 127c0 68 83 123 216 123zM111 63c-2 -8 -3 -16 -3 -24c0 -32 15 -66 35 -89c21 -28 58 -52 94 -52c10 0 21 1 31 4c33 8 46 36 46 67c0 60 -55 134 -124 134c-31 0 -68 -5 -79 -40z";
const WHOLE_WIDTH = 422;
const BRAVURA_SPACE = 250;
const INK = "#151515";

export interface StaffNote {
  /** passo: 0 = 1ª linha (Mi4), meia linha por passo */
  step: number;
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
  children,
}: {
  geo: StaffGeometry;
  notes: StaffNote[];
  /** centro horizontal de cada nota */
  xs: number[];
  label: string;
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
          <line key={st} x1={4} x2={width - 4} y1={y(st)} y2={y(st)} />
        ))}
      </g>
      <path d={CLEF} fill={INK} transform={`translate(${s * 0.75} ${y(2)}) scale(${k} ${-k})`} />
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
