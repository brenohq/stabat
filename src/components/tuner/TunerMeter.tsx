import { useEffect, useRef } from "react";
import { CLOSE_CENTS, IN_TUNE_CENTS, WRONG_NOTE_CENTS, zoneOf, type Zone } from "../../lib/tuner/tuning";
import { ZONE_COLOR, type MeterStyle } from "./meterStyles";

const LIMIT = WRONG_NOTE_CENTS;
const clamp = (c: number) => Math.max(-LIMIT, Math.min(LIMIT, c));

/** o mostrador; `cents` null = sem som (tudo cinza, em repouso) */
export function TunerMeter({ cents, style }: { cents: number | null; style: MeterStyle }) {
  const color = cents === null ? "var(--muted)" : ZONE_COLOR[zoneOf(cents)];
  const label =
    cents === null
      ? "sem som"
      : `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${Math.abs(Math.round(cents))} cents`;
  return (
    <div role="img" aria-label={`Mostrador: ${label}`} className="w-full">
      {style === "needle" ? (
        <Needle cents={cents} color={color} />
      ) : style === "bar" ? (
        <Bar cents={cents} color={color} />
      ) : (
        <Strobe cents={cents} color={color} />
      )}
    </div>
  );
}

const W = 300;

function Needle({ cents, color }: { cents: number | null; color: string }) {
  const cx = W / 2;
  const cy = 158;
  const r = 128;
  const deg = (c: number) => (clamp(c) / LIMIT) * 60;
  const at = (c: number, rr: number) => {
    const a = (deg(c) * Math.PI) / 180;
    return [cx + Math.sin(a) * rr, cy - Math.cos(a) * rr] as const;
  };
  const arc = (c0: number, c1: number, zone: Zone) => {
    const [x0, y0] = at(c0, r + 8);
    const [x1, y1] = at(c1, r + 8);
    return (
      <path
        key={`${c0}`}
        d={`M${x0} ${y0} A${r + 8} ${r + 8} 0 0 1 ${x1} ${y1}`}
        stroke={ZONE_COLOR[zone]}
        strokeWidth={7}
        fill="none"
        opacity={0.45}
      />
    );
  };
  const ticks = [];
  for (let c = -50; c <= 50; c += 5) {
    const big = c % 25 === 0;
    const [x0, y0] = at(c, r - (big ? 14 : 7));
    const [x1, y1] = at(c, r);
    ticks.push(
      <line key={c} x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--muted)" strokeWidth={big ? 2 : 1} />,
    );
  }
  const labels = [-50, -25, 25, 50].map((c) => {
    const [x, y] = at(c, r - 28);
    return (
      <text key={c} x={x} y={y + 4} textAnchor="middle" fontSize={11} fill="var(--muted)">
        {c > 0 ? `+${c}` : c < 0 ? `−${-c}` : "0"}
      </text>
    );
  });
  return (
    <svg viewBox={`0 0 ${W} 172`} className="mx-auto block w-full max-w-[420px]">
      {arc(-LIMIT, -CLOSE_CENTS, "off")}
      {arc(-CLOSE_CENTS, -IN_TUNE_CENTS, "close")}
      {arc(-IN_TUNE_CENTS, IN_TUNE_CENTS, "ok")}
      {arc(IN_TUNE_CENTS, CLOSE_CENTS, "close")}
      {arc(CLOSE_CENTS, LIMIT, "off")}
      {ticks}
      {labels}
      {(["♭", "♯"] as const).map((sign, k) => {
        const [x, y] = at(k ? LIMIT : -LIMIT, r + 26);
        return (
          <text key={sign} x={x} y={y + 6} fontSize={18} fill="var(--muted)" textAnchor="middle">
            {sign}
          </text>
        );
      })}
      <g
        style={{
          transform: `rotate(${cents === null ? 0 : deg(cents)}deg)`,
          transformOrigin: `${cx}px ${cy}px`,
          transition: "transform 90ms linear",
        }}
        opacity={cents === null ? 0.35 : 1}
      >
        <line x1={cx} y1={cy} x2={cx} y2={cy - r + 4} stroke={color} strokeWidth={4} strokeLinecap="round" />
      </g>
      <circle cx={cx} cy={cy} r={8} fill={color} />
    </svg>
  );
}

function Bar({ cents, color }: { cents: number | null; color: string }) {
  const mid = W / 2;
  const half = W / 2 - 16;
  const x = (c: number) => mid + (clamp(c) / LIMIT) * half;
  const okW = (IN_TUNE_CENTS / LIMIT) * half;
  const pos = cents === null ? mid : x(cents);
  return (
    <svg viewBox={`0 0 ${W} 78`} className="mx-auto block w-full max-w-[420px]">
      <rect x={16} y={14} width={W - 32} height={28} rx={14} fill="var(--line)" />
      <rect
        x={mid - okW}
        y={14}
        width={okW * 2}
        height={28}
        fill="var(--ok-soft)"
        stroke="var(--ok)"
        strokeDasharray="3 3"
      />
      {cents !== null && (
        <rect
          x={Math.min(mid, pos)}
          y={20}
          width={Math.abs(pos - mid)}
          height={16}
          rx={4}
          fill={color}
          opacity={0.8}
        />
      )}
      <circle
        cx={0}
        cy={28}
        r={11}
        fill={color}
        stroke="var(--surface)"
        strokeWidth={3}
        style={{ transform: `translateX(${pos}px)`, transition: "transform 90ms linear" }}
        opacity={cents === null ? 0.4 : 1}
      />
      {[-50, -25, 0, 25, 50].map((c) => (
        <g key={c}>
          <line x1={x(c)} x2={x(c)} y1={48} y2={c === 0 ? 58 : 54} stroke="var(--muted)" />
          <text x={x(c)} y={72} fontSize={11} textAnchor="middle" fill="var(--muted)">
            {c > 0 ? `+${c}` : c < 0 ? `−${-c}` : "0"}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** listras que andam: paradas = afinado; para a direita = alto, para a esquerda = baixo */
function Strobe({ cents, color }: { cents: number | null; color: string }) {
  const rows = useRef<(SVGGElement | null)[]>([]);
  const latest = useRef(cents);
  useEffect(() => {
    latest.current = cents;
  }, [cents]);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let phase = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (latest.current !== null) phase += clamp(latest.current) * dt * 3;
      rows.current.forEach((g, k) => {
        const size = k ? 14 : 28;
        const off = (((phase * (k + 1)) % (size * 2)) + size * 2) % (size * 2);
        g?.setAttribute("transform", `translate(${off - size * 2} 0)`);
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox={`0 0 ${W} 64`} className="block w-full max-w-[420px]">
        <defs>
          <clipPath id="strobe-clip">
            <rect x={8} y={4} width={W - 16} height={56} rx={10} />
          </clipPath>
        </defs>
        <rect x={8} y={4} width={W - 16} height={56} rx={10} fill="var(--surface-2)" stroke="var(--line)" />
        <g clipPath="url(#strobe-clip)">
          {[28, 14].map((size, k) => (
            <g key={size} ref={(el) => void (rows.current[k] = el)}>
              {Array.from({ length: Math.ceil((W + size * 4) / (size * 2)) }, (_, i) => (
                <rect
                  key={i}
                  x={i * size * 2}
                  y={4 + k * 28}
                  width={size}
                  height={28}
                  fill={color}
                  opacity={k ? 0.5 : 0.85}
                />
              ))}
            </g>
          ))}
        </g>
      </svg>
      <p className="text-xs text-muted">Paradas = afinado · para a direita = alto</p>
    </div>
  );
}
