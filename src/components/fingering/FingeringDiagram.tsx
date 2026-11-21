import type { ReactNode } from "react";
import type { Fingering, Mechanism } from "../../lib/fingering/tables";

/*
 * Diagramas de digitação no estilo das tabelas dos métodos, em SVG próprio.
 * Ficam sempre sobre o "papel" (claro nos dois temas, como a partitura), então as cores são fixas.
 * Apertado = cheio (azul-marinho); solto = vazado; chaves que a escala não usa ficam bem claras,
 * só para situar a mão. Sem destaques dourados (decisão do músico: polui).
 * `mini` = a miniatura sob cada nota da pauta: traço grosso, sem rótulos nem chaves de referência.
 */
const C = {
  ink: "#1f2a44",
  open: "#fffdf8",
  ghost: "#cfc7b6",
  pearl: "#f1ece2",
  muted: "#7a7466",
  guide: "#e8e0cf",
  tick: "#b9ad94",
  inner: "#a9a293",
};

type Shape =
  | { t: "c"; x: number; y: number; r: number }
  | { t: "e"; x: number; y: number; rx: number; ry: number; rot?: number };

function Key({
  shape,
  on,
  id,
  ghost,
  mini,
}: {
  shape: Shape;
  on?: boolean;
  id?: string;
  ghost?: boolean;
  mini?: boolean;
}) {
  if (ghost && mini) return null;
  const props = {
    fill: on ? C.ink : C.open,
    stroke: ghost ? C.ghost : C.ink,
    strokeWidth: mini ? 5 : 1.5,
    "data-key": id,
    "data-on": id ? (on ? "1" : "0") : undefined,
  };
  return shape.t === "c" ? (
    <circle cx={shape.x} cy={shape.y} r={shape.r} {...props} />
  ) : (
    <ellipse
      cx={shape.x}
      cy={shape.y}
      rx={shape.rx}
      ry={shape.ry}
      transform={shape.rot ? `rotate(${shape.rot} ${shape.x} ${shape.y})` : undefined}
      {...props}
    />
  );
}

function Label({
  x,
  y,
  children,
  anchor = "middle",
  caps,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: "start" | "middle" | "end";
  caps?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fill={C.muted}
      style={{
        font: caps ? "600 9px var(--font-sans)" : "500 10px var(--font-sans)",
        letterSpacing: caps ? ".1em" : ".02em",
      }}
    >
      {children}
    </text>
  );
}

const svgProps = (w: number, h: number, label: string) => ({
  viewBox: `0 0 ${w} ${h}`,
  role: "img" as const,
  "aria-label": label,
  className: "block h-auto w-full",
});

// ---------- pistões ----------
const FINGERS = ["indicador", "médio", "anelar"];
function Valves({ f, mini }: { f: Fingering; mini?: boolean }) {
  const down = f.kind === "valves" ? f.valves : [];
  return (
    <svg {...svgProps(260, mini ? 92 : 128, "Pistões")}>
      {[1, 2, 3].map((v, i) => {
        const x = 52 + i * 78,
          y = 46 + (mini ? 0 : 16),
          on = down.includes(v);
        return (
          <g key={v}>
            {!mini && (
              <>
                <circle cx={x} cy={y} r={31} fill="none" stroke={C.guide} strokeWidth={1.2} />
                <path
                  d={Array.from({ length: 36 }, (_, a) => {
                    const t = (a / 36) * Math.PI * 2;
                    return `M${(x + Math.cos(t) * 28).toFixed(1)} ${(y + Math.sin(t) * 28).toFixed(1)}L${(x + Math.cos(t) * 31).toFixed(1)} ${(y + Math.sin(t) * 31).toFixed(1)}`;
                  }).join("")}
                  stroke={C.guide}
                  strokeWidth={0.8}
                />
              </>
            )}
            <Key shape={{ t: "c", x, y, r: mini ? 26 : on ? 18 : 21.5 }} on={on} id={String(v)} mini={mini} />
            {!mini && (
              <>
                <circle cx={x} cy={y} r={on ? 11.5 : 14} fill={on ? "rgb(255 255 255 / .16)" : C.pearl} />
                <text
                  x={x}
                  y={y + 5}
                  textAnchor="middle"
                  fill={on ? "#fff" : C.muted}
                  style={{ font: "600 13px var(--font-sans)" }}
                >
                  {v}
                </text>
                <Label x={x} y={y + 52} caps>
                  {FINGERS[i]}
                </Label>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ---------- vara ----------
// a vara externa é mais comprida que o curso inteiro (6 passos): na 7ª ainda cobre a ponta dos tubos internos
const SL = { x1: 46, step: 24, len: 166, yT: 40, yB: 60 };
function Slide({ f, mini }: { f: Fingering; mini?: boolean }) {
  const pos = f.kind === "slide" ? f.position : 1;
  if (mini)
    return (
      <svg {...svgProps(40, 40, `${pos}ª posição`)}>
        <circle cx={20} cy={20} r={17} fill={C.open} stroke={C.ink} strokeWidth={2} />
        <text x={20} y={26} textAnchor="middle" fill={C.ink} style={{ font: "600 17px var(--font-sans)" }}>
          {pos}
        </text>
      </svg>
    );
  const right = SL.x1 + 6 * SL.step;
  const end = right + SL.len + 16;
  const mid = (SL.yT + SL.yB) / 2;
  return (
    <svg {...svgProps(end, 122, `Vara na ${pos}ª posição`)}>
      <path
        d={`M18 ${SL.yT}H${SL.x1 + SL.len - 8}M18 ${SL.yB}H${SL.x1 + SL.len - 8}`}
        stroke={C.inner}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <path d={`M18 ${SL.yT - 5}V${SL.yB + 5}`} stroke={C.ink} strokeWidth={1.5} strokeLinecap="round" />
      <path d={`M6 ${SL.yT - 7}l10 5v4l-10 5z`} fill={C.open} stroke={C.ink} strokeWidth={1.5} />
      {/* a vara anda com a mão direita */}
      <g
        data-testid="slide"
        style={{
          transform: `translateX(${(pos - 1) * SL.step}px)`,
          transition: "transform .4s cubic-bezier(.3,.7,.2,1)",
        }}
        className="motion-reduce:!transition-none"
      >
        <path
          d={`M${SL.x1} ${SL.yT}H${SL.x1 + SL.len}a10 10 0 0 1 0 ${SL.yB - SL.yT}H${SL.x1}`}
          fill="none"
          stroke={C.ink}
          strokeWidth={3.2}
          strokeLinecap="round"
        />
        <path d={`M${SL.x1 + 6} ${SL.yT}V${SL.yB}`} stroke={C.ink} strokeWidth={2} />
        <circle cx={SL.x1 + 6} cy={mid} r={6.5} fill={C.ink} />
      </g>
      <path d={`M${SL.x1 + 6} 84H${right + 6}`} stroke={C.tick} />
      {[1, 2, 3, 4, 5, 6, 7].map((p) => {
        const x = SL.x1 + 6 + (p - 1) * SL.step,
          on = p === pos;
        return (
          <g key={p} data-pos={p} data-on={on ? "1" : "0"}>
            <path d={`M${x} 80V88`} stroke={C.tick} />
            {on && <circle cx={x} cy={104} r={10} fill={C.ink} />}
            <text
              x={x}
              y={108}
              textAnchor="middle"
              fill={on ? "#fff" : C.muted}
              style={{ font: "600 13px var(--font-sans)" }}
            >
              {p}
            </text>
          </g>
        );
      })}
      <Label x={SL.x1 + 6} y={22} anchor="start" caps>
        mão direita
      </Label>
    </svg>
  );
}

// ---------- chaves: sax, clarinete, flauta doce (mesma moldura vertical) ----------
const X = 100;
function Frame({
  label,
  children,
  mini,
  height = 340,
}: {
  label: string;
  children: ReactNode;
  mini?: boolean;
  height?: number;
}) {
  return (
    <svg {...svgProps(200, height, label)}>
      {!mini && (
        <>
          <path d={`M${X} 46V326`} stroke={C.guide} strokeWidth={1.2} />
          <path d={`M${X - 26} 184H${X + 26}`} stroke={C.guide} strokeWidth={1.2} strokeDasharray="3 4" />
        </>
      )}
      {children}
    </svg>
  );
}

/** rótulos de uma lista [x, y, texto, âncora?] */
const labels = (list: [number, number, string, ("start" | "middle" | "end")?][], caps = false) =>
  list.map(([x, y, t, anchor], i) => (
    <Label key={i} x={x} y={y} anchor={anchor} caps={caps}>
      {t}
    </Label>
  ));

function Sax({ f, mini }: { f: Fingering; mini?: boolean }) {
  const k = (id: string) => f.kind === "keys" && f.keys.includes(id);
  const K = (id: string, shape: Shape) => <Key key={id} id={id} shape={shape} on={k(id)} mini={mini} />;
  const G = (shape: Shape, i: number) => <Key key={`g${i}`} shape={shape} ghost mini={mini} />;
  return (
    <Frame label="Chaves do saxofone" mini={mini}>
      {!mini && (
        <>
          {labels(
            [
              [14, 120, "ME", "start"],
              [14, 256, "MD", "start"],
            ],
            true,
          )}
          {labels([
            [52, 30, "8ª"],
            [154, 35, "Ré", "start"],
            [160, 51, "Mi♭", "start"],
            [154, 67, "Fá", "start"],
            [X + 12, 102, "bis", "start"],
            [50, 160, "Sol♯"],
            [33, 192, "Si", "end"],
            [66, 192, "Dó♯", "start"],
            [50, 220, "Si♭"],
            [154, 217, "Mi", "start"],
            [160, 301, "Mi♭", "start"],
            [160, 319, "Dó", "start"],
          ])}
        </>
      )}
      {K("oct", { t: "e", x: 52, y: 48, rx: 10, ry: 6.5, rot: -25 })}
      {/* chaves de palma (mão esquerda) */}
      {K("pd", { t: "e", x: 140, y: 32, rx: 8, ry: 5, rot: -20 })}
      {K("peb", { t: "e", x: 146, y: 48, rx: 8, ry: 5, rot: -20 })}
      {K("pf", { t: "e", x: 140, y: 64, rx: 8, ry: 5, rot: -20 })}
      {K("L1", { t: "c", x: X, y: 76, r: 15 })}
      {K("bis", { t: "c", x: X, y: 99, r: 5 })}
      {K("L2", { t: "c", x: X, y: 122, r: 15 })}
      {K("L3", { t: "c", x: X, y: 160, r: 15 })}
      {/* mesa do mínimo esquerdo */}
      {K("gs", { t: "e", x: 50, y: 172, rx: 10, ry: 5 })}
      {K("lowb", { t: "e", x: 43, y: 189, rx: 6.5, ry: 4.5 })}
      {K("cs", { t: "e", x: 57, y: 189, rx: 6.5, ry: 4.5 })}
      {K("lowbb", { t: "e", x: 50, y: 204, rx: 8, ry: 4.5 })}
      {K("R1", { t: "c", x: X, y: 214, r: 15 })}
      {K("R2", { t: "c", x: X, y: 252, r: 15 })}
      {K("R3", { t: "c", x: X, y: 290, r: 15 })}
      {/* laterais da mão direita: o Mi agudo e duas que as escalas não usam */}
      {K("se", { t: "e", x: 142, y: 214, rx: 7, ry: 4.5, rot: 10 })}
      {G({ t: "e", x: 144, y: 230, rx: 7, ry: 4.5, rot: 10 }, 1)}
      {G({ t: "e", x: 142, y: 246, rx: 7, ry: 4.5, rot: 10 }, 2)}
      {/* mínimo direito */}
      {K("eb", { t: "e", x: 146, y: 298, rx: 10, ry: 5.5, rot: 8 })}
      {K("lowc", { t: "e", x: 146, y: 316, rx: 10, ry: 5.5, rot: 8 })}
    </Frame>
  );
}

function Clarinet({ f, mini }: { f: Fingering; mini?: boolean }) {
  const k = (id: string) => f.kind === "keys" && f.keys.includes(id);
  const K = (id: string, shape: Shape) => <Key key={id} id={id} shape={shape} on={k(id)} mini={mini} />;
  const G = (shape: Shape, i: number) => <Key key={`g${i}`} shape={shape} ghost mini={mini} />;
  const hole = (id: string, y: number) => (
    <g key={id}>
      {K(id, { t: "c", x: X, y, r: 13.5 })}
      {!mini && <circle cx={X} cy={y} r={17} fill="none" stroke={C.guide} strokeWidth={1.2} />}
    </g>
  );
  return (
    <Frame label="Chaves do clarinete" mini={mini}>
      {!mini && (
        <>
          {labels(
            [
              [176, 120, "ME", "start"],
              [176, 268, "MD", "start"],
            ],
            true,
          )}
          {labels([
            [X - 16, 33, "Lá", "end"],
            [140, 45, "Sol♯", "start"],
            [52, 54, "reg."],
            [52, 120, "polegar"],
            [38, 175, "Dó♯", "end"],
            [38, 195, "Fá♯", "end"],
            [38, 215, "Mi", "end"],
            [138, 241, "Mi♭", "start"],
            [162, 307, "Fá", "start"],
            [162, 325, "Sol♯", "start"],
          ])}
        </>
      )}
      {K("akey", { t: "e", x: X, y: 30, rx: 10, ry: 5 })}
      {K("gs", { t: "e", x: 128, y: 42, rx: 7, ry: 4.5, rot: 20 })}
      {K("reg", { t: "e", x: 52, y: 68, rx: 8, ry: 4.5, rot: -20 })}
      {K("T", { t: "c", x: 52, y: 94, r: 11 })}
      {hole("L1", 72)}
      {hole("L2", 112)}
      {hole("L3", 152)}
      {/* mínimo esquerdo */}
      {K("cs", { t: "e", x: 52, y: 172, rx: 10, ry: 5 })}
      {K("fsc", { t: "e", x: 52, y: 192, rx: 10, ry: 5 })}
      {K("eb", { t: "e", x: 52, y: 212, rx: 10, ry: 5 })}
      {/* chaves laterais da mão direita: só a de baixo (Mi♭/Si♭) entra nas escalas */}
      {G({ t: "e", x: 128, y: 200, rx: 6.5, ry: 4, rot: 10 }, 1)}
      {G({ t: "e", x: 130, y: 213, rx: 6.5, ry: 4, rot: 10 }, 2)}
      {G({ t: "e", x: 128, y: 226, rx: 6.5, ry: 4, rot: 10 }, 3)}
      {K("s4", { t: "e", x: 126, y: 239, rx: 7, ry: 4.5, rot: 10 })}
      {hole("R1", 214)}
      {hole("R2", 254)}
      {hole("R3", 294)}
      {/* mínimo direito */}
      {K("fc", { t: "e", x: 150, y: 304, rx: 10, ry: 5.5, rot: 8 })}
      {K("gsd", { t: "e", x: 150, y: 322, rx: 10, ry: 5.5, rot: 8 })}
    </Frame>
  );
}

function Recorder({ f, mini }: { f: Fingering; mini?: boolean }) {
  const k = (id: string) => f.kind === "keys" && f.keys.includes(id);
  const K = (id: string, shape: Shape) => <Key key={id} id={id} shape={shape} on={k(id)} mini={mini} />;
  const half = k("Th");
  const tx = 52,
    ty = 96,
    tr = 11;
  // furo duplo: inteiro (os dois), metade (só o maior) ou aberto
  const pair = (id: string, y: number, big: number, small: number) => {
    const full = k(id),
      part = k(`${id}h`);
    return (
      <g data-key={id} data-on={full ? "1" : part ? "half" : "0"}>
        <Key shape={{ t: "c", x: X - 8, y, r: big }} on={full || part} mini={mini} />
        <Key shape={{ t: "c", x: X + 8, y, r: small }} on={full} mini={mini} />
      </g>
    );
  };
  return (
    <Frame label="Orifícios da flauta doce" mini={mini} height={352}>
      {!mini && (
        <>
          {/* bico, para orientar: em cima */}
          <path d={`M${X - 9} 14h18l-2 22h-14z`} fill="none" stroke={C.guide} strokeWidth={1.2} />
          {labels(
            [
              [164, 112, "ME", "start"],
              [164, 256, "MD", "start"],
            ],
            true,
          )}
          <Label x={tx} y={122}>
            {half ? "meio polegar" : "polegar"}
          </Label>
          {(k("R3h") || k("R4h")) && (
            <Label x={X + 22} y={k("R3h") ? 287 : 317} anchor="start">
              metade
            </Label>
          )}
          {k("bell") && (
            <Label x={X + 22} y={345} anchor="start">
              ponta tampada
            </Label>
          )}
        </>
      )}
      {/* polegar atrás: inteiro, meio (agudo) ou aberto */}
      <g data-key="T" data-on={k("T") ? "1" : half ? "half" : "0"}>
        <circle
          cx={tx}
          cy={ty}
          r={tr}
          fill={k("T") ? C.ink : C.open}
          stroke={C.ink}
          strokeWidth={mini ? 5 : 1.5}
        />
        {half && <path d={`M${tx} ${ty - tr}A${tr} ${tr} 0 0 0 ${tx} ${ty + tr}Z`} fill={C.ink} />}
      </g>
      {K("L1", { t: "c", x: X, y: 72, r: 13 })}
      {K("L2", { t: "c", x: X, y: 110, r: 13 })}
      {K("L3", { t: "c", x: X, y: 148, r: 13 })}
      {K("R1", { t: "c", x: X, y: 210, r: 13 })}
      {K("R2", { t: "c", x: X, y: 248, r: 13 })}
      {pair("R3", 284, 7, 5)}
      {pair("R4", 314, 6.5, 4.5)}
      {/* a ponta da flauta, tampada na perna só no Dó♯ agudo */}
      {(k("bell") || !mini) && (
        <ellipse
          cx={X}
          cy={341}
          rx={12}
          ry={4}
          fill={k("bell") ? C.ink : C.open}
          stroke={k("bell") ? C.ink : C.ghost}
          strokeWidth={mini ? 5 : 1.5}
          data-key="bell"
          data-on={k("bell") ? "1" : "0"}
        />
      )}
    </Frame>
  );
}

export function FingeringDiagram({
  mechanism,
  fingering,
  mini,
}: {
  mechanism: Mechanism;
  fingering: Fingering;
  mini?: boolean;
}) {
  switch (mechanism) {
    case "valves":
      return <Valves f={fingering} mini={mini} />;
    case "slide":
      return <Slide f={fingering} mini={mini} />;
    case "sax":
      return <Sax f={fingering} mini={mini} />;
    case "clarinet":
      return <Clarinet f={fingering} mini={mini} />;
    case "recorder":
      return <Recorder f={fingering} mini={mini} />;
  }
}
