import type { Ref } from "react";
import { MEASURE, SIXTEENTHS_PER_BEAT } from "../../lib/games/rhythm/cells";
import {
  BEAM,
  INK,
  K,
  MUTED,
  RULE,
  RULER,
  S,
  STAFF_BAD,
  STAFF_OK,
  STEM,
  STEM_W,
  WIDTH,
  X_END,
  X_START,
  noteY,
  rulerY,
  stepY,
  staffPoint,
  xOf,
} from "./rhythmStaffLayout";
import type { RhythmEvent } from "../../lib/games/rhythm/measure";
import {
  DOT,
  FLAG_16TH,
  FLAG_8TH,
  HEAD_BLACK,
  HEAD_HALF,
  HEAD_WIDTH,
  CLEF,
  REST_8TH,
  REST_HALF,
  REST_QUARTER,
  REST_WHOLE,
  REST_WIDTH,
  TIME_SIG_4,
  TIME_SIG_WIDTH,
  WHOLE,
  WHOLE_WIDTH,
} from "./bravura";

/*
 * Pauta do "Bate o ritmo": cinco linhas em clave de sol, um compasso por linha, cada um com clave e
 * 4/4, e todas as notas no Lá (o ritmo é o que conta). As notas ficam
 * espaçadas pelo tempo, então a régua embaixo (tempos 1 a 4) se alinha com elas. Glifos da Bravura;
 * hastes e barras de ligação desenhadas. A pauta é sempre papel claro (cores fixas, como no NoteStaff).
 */
const glyph = (d: string, x: number, y: number, fill = "currentColor") => (
  <path d={d} fill={fill} transform={`translate(${x} ${y}) scale(${K} ${-K})`} />
);

export interface StaffTap {
  /** em semicolcheias desde o começo */
  pos: number;
  state: "live" | "ok" | "bad";
}

export function RhythmStaff({
  events,
  measures,
  ruler = false,
  offbeats = false,
  colors,
  marks,
  taps = [],
  cursorRef,
  label,
}: {
  events: RhythmEvent[];
  measures: number;
  ruler?: boolean;
  /** marca o "e" de cada tempo na régua */
  offbeats?: boolean;
  /** cor de cada nota (índice entre as notas, sem as pausas) */
  colors?: (string | undefined)[];
  /** texto sobre o ataque de cada nota na régua ("cedo", "tarde") */
  marks?: (string | undefined)[];
  taps?: StaffTap[];
  cursorRef?: Ref<SVGLineElement>;
  label: string;
}) {
  const height = stepY(measures - 1, 0) + (ruler ? RULER + 28 : 22);
  const notes = events.filter((e) => !e.rest);
  const noteIndex = new Map(notes.map((e, i) => [e, i]));
  // barras de ligação: notas menores que a semínima, juntas no mesmo tempo
  const beamed = new Set<RhythmEvent>();
  const groups: RhythmEvent[][] = [];
  for (let b = 0; b < (measures * MEASURE) / SIXTEENTHS_PER_BEAT; b++) {
    const g = notes.filter((e) => e.dur < 4 && Math.floor(e.on / SIXTEENTHS_PER_BEAT) === b);
    if (g.length >= 2) {
      groups.push(g);
      g.forEach((e) => beamed.add(e));
    }
  }
  const pos = (e: RhythmEvent) => {
    const line = Math.floor(e.on / MEASURE);
    return { x: xOf(e.on - line * MEASURE), y: noteY(line), line };
  };
  const stemX = (e: RhythmEvent) => pos(e).x + (HEAD_WIDTH * K) / 2;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      role="img"
      aria-label={label}
      className="block h-auto w-full select-none"
      data-testid="rhythm-staff"
    >
      {Array.from({ length: measures }, (_, m) => {
        const y = (step: number) => stepY(m, step);
        const last = m === measures - 1;
        const barTop = y(8);
        const barH = y(0) - y(8);
        return (
          <g key={m}>
            {[0, 2, 4, 6, 8].map((st) => (
              <line key={st} x1={8} x2={X_END + 14} y1={y(st)} y2={y(st)} stroke={INK} strokeWidth={1.2} />
            ))}
            {glyph(CLEF, 14, y(2), INK)}
            {glyph(TIME_SIG_4, 74 - (TIME_SIG_WIDTH * K) / 2, y(6), INK)}
            {glyph(TIME_SIG_4, 74 - (TIME_SIG_WIDTH * K) / 2, y(2), INK)}
            {last ? (
              <>
                <line
                  x1={X_END + 6}
                  x2={X_END + 6}
                  y1={barTop}
                  y2={barTop + barH}
                  stroke={INK}
                  strokeWidth={1.2}
                />
                <rect x={X_END + 9} y={barTop} width={5} height={barH} fill={INK} />
              </>
            ) : (
              <line
                x1={X_END + 13}
                x2={X_END + 13}
                y1={barTop}
                y2={barTop + barH}
                stroke={INK}
                strokeWidth={1.2}
              />
            )}
            {ruler && (
              <g>
                <line
                  x1={X_START - 14}
                  x2={X_END}
                  y1={rulerY(m)}
                  y2={rulerY(m)}
                  stroke={RULE}
                  strokeWidth={2}
                />
                {[0, 1, 2, 3].map((b) => {
                  const x = xOf(b * SIXTEENTHS_PER_BEAT);
                  const xe = xOf(b * SIXTEENTHS_PER_BEAT + 2);
                  return (
                    <g key={b}>
                      <line
                        x1={x}
                        x2={x}
                        y1={rulerY(m) - 5}
                        y2={rulerY(m) + 5}
                        stroke={MUTED}
                        strokeWidth={2}
                      />
                      <text
                        x={x}
                        y={rulerY(m) + 22}
                        textAnchor="middle"
                        fill={MUTED}
                        fontSize={14}
                        fontWeight={600}
                      >
                        {b + 1}
                      </text>
                      {offbeats && (
                        <>
                          <line
                            x1={xe}
                            x2={xe}
                            y1={rulerY(m) - 3}
                            y2={rulerY(m) + 3}
                            stroke={MUTED}
                            strokeWidth={1.4}
                          />
                          <text x={xe} y={rulerY(m) + 22} textAnchor="middle" fill={MUTED} fontSize={13}>
                            e
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </g>
            )}
          </g>
        );
      })}

      {ruler &&
        notes.map((e, i) => {
          const { x } = pos(e);
          const ry = rulerY(Math.floor(e.on / MEASURE));
          return (
            <g key={`m${i}`}>
              <path d={`M${x - 4.5} ${ry - 15} L${x + 4.5} ${ry - 15} L${x} ${ry - 8} Z`} fill={MUTED} />
              {marks?.[i] && (
                <text x={x} y={ry - 20} textAnchor="middle" fill={MUTED} fontSize={12} fontWeight={600}>
                  {marks[i]}
                </text>
              )}
            </g>
          );
        })}

      {events.map((e, i) => {
        const { x, y, line } = pos(e);
        const k = noteIndex.get(e);
        const color = (k !== undefined && colors?.[k]) || INK;
        if (e.rest) {
          const d =
            e.dur === 16 ? REST_WHOLE : e.dur === 8 ? REST_HALF : e.dur === 4 ? REST_QUARTER : REST_8TH;
          return (
            <g key={i} color={INK} data-testid="rest">
              {/* semibreve pendurada na 4ª linha; as outras pausas na linha do meio */}
              {glyph(d, x - (REST_WIDTH * K) / 2, stepY(line, e.dur === 16 ? 6 : 4))}
            </g>
          );
        }
        const sx = stemX(e);
        return (
          <g key={i} color={color} style={{ transition: "color .2s" }} data-testid="rhythm-note">
            {e.dur === 16
              ? glyph(WHOLE, x - (WHOLE_WIDTH * K) / 2, y)
              : glyph(e.dur >= 8 ? HEAD_HALF : HEAD_BLACK, x - (HEAD_WIDTH * K) / 2, y)}
            {e.dur < 16 && (
              <rect x={sx - STEM_W} y={y - STEM} width={STEM_W} height={STEM - 0.2 * S} fill="currentColor" />
            )}
            {[3, 6, 12].includes(e.dur) && glyph(DOT, sx + 0.45 * S, y)}
            {e.dur < 4 && !beamed.has(e) && glyph(e.dur === 1 ? FLAG_16TH : FLAG_8TH, sx - STEM_W, y - STEM)}
          </g>
        );
      })}

      {groups.map((g, gi) => {
        const y = pos(g[0]!).y - STEM;
        const a = stemX(g[0]!) - STEM_W;
        const b = stemX(g[g.length - 1]!);
        const secondary: [number, number][] = [];
        for (let i = 0; i + 1 < g.length; i++)
          if (g[i]!.dur === 1 && g[i + 1]!.dur === 1)
            secondary.push([stemX(g[i]!) - STEM_W, stemX(g[i + 1]!)]);
        return (
          <g key={`b${gi}`} fill={INK}>
            <rect x={a} y={y} width={b - a} height={BEAM} />
            {secondary.map(([s0, s1], i) => (
              <rect key={i} x={s0} y={y + BEAM * 1.5} width={s1 - s0} height={BEAM} />
            ))}
          </g>
        );
      })}

      {taps.map((t, i) => {
        const p = staffPoint(t.pos, measures);
        return (
          <circle
            key={i}
            cx={p.x}
            cy={rulerY(p.line)}
            r={6}
            fill={t.state === "ok" ? STAFF_OK : t.state === "bad" ? STAFF_BAD : "#1f2a44"}
            data-testid="tap-mark"
            data-state={t.state}
          />
        );
      })}

      {ruler && (
        <line
          ref={cursorRef}
          x1={0}
          x2={0}
          y1={0}
          y2={0}
          stroke="#a8761c"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0}
          data-testid="rhythm-cursor"
        />
      )}
    </svg>
  );
}
