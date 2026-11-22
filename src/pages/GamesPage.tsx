import type { ReactNode } from "react";
import { Link } from "react-router";
import { TopBar } from "../components/TopBar";
import { ArrowIcon } from "../components/icons";
import { usePageView } from "../hooks/usePageView";
import { NOTES, NOTE_COLORS } from "../lib/games/notes";
import { levelOf as noteLevel, normalize as normalizeNotes } from "../lib/games/scheduler";
import { CELLS } from "../lib/games/rhythm/cells";
import { levelOf as rhythmLevel, normalize as normalizeRhythm } from "../lib/games/rhythm/scheduler";
import { noteGame, rhythmGame } from "../lib/storage";

interface Game {
  path: string;
  title: string;
  summary: string;
  cover: ReactNode;
  /** o que já foi feito (lido da memória do jogo neste aparelho), ou null se nunca jogou */
  progress: () => string | null;
}

/** fundo das capas: degradê com as cinco linhas da pauta, como nos cartões dos Estudos */
function CoverFrame({ id, hue, children }: { id: string; hue: [number, number]; children: ReactNode }) {
  return (
    <div className="relative h-28 overflow-hidden">
      <svg
        viewBox="0 0 400 112"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
        className="absolute inset-0 size-full"
      >
        <defs>
          <linearGradient id={`game-${id}`} x1="0" x2="1">
            <stop offset="0" stopColor={`hsl(${hue[0]} 45% 38%)`} />
            <stop offset="1" stopColor={`hsl(${hue[1]} 45% 26%)`} />
          </linearGradient>
        </defs>
        <rect width="400" height="112" fill={`url(#game-${id})`} />
        {[0, 2, 4, 6, 8].map((s) => (
          <line key={s} x1="0" x2="400" y1={74 - s * 4.5} y2={74 - s * 4.5} stroke="rgb(255 255 255 / .22)" />
        ))}
        {children}
      </svg>
    </div>
  );
}

const y = (step: number) => 74 - step * 4.5;

/** Dó Ré Mi… subindo, cada nota na sua cor do jogo */
function NoteCover() {
  return (
    <CoverFrame id="que-nota" hue={[20, 235]}>
      {NOTE_COLORS.map((c, i) => {
        const cx = 120 + i * 30;
        const cy = y(i - 2);
        return (
          <g key={c}>
            {i === 0 && <line x1={cx - 11} x2={cx + 11} y1={cy} y2={cy} stroke="rgb(255 255 255 / .5)" />}
            <ellipse
              cx={cx}
              cy={cy}
              rx={7.2}
              ry={5}
              fill="none"
              stroke={c}
              strokeWidth={3.4}
              transform={`rotate(-20 ${cx} ${cy})`}
            />
          </g>
        );
      })}
    </CoverFrame>
  );
}

/** semínima, duas colcheias e quatro semicolcheias, todas no Lá */
function RhythmCover() {
  const at = [0, 4, 6, 8, 9, 10, 11];
  const x = (on: number) => 116 + on * 13;
  const cy = y(3);
  const stem = (on: number) => x(on) + 6;
  const ink = "rgb(255 255 255 / .9)";
  return (
    <CoverFrame id="ritmo" hue={[165, 215]}>
      {at.map((on) => (
        <g key={on} fill={ink}>
          <ellipse cx={x(on)} cy={cy} rx={6.6} ry={4.6} transform={`rotate(-20 ${x(on)} ${cy})`} />
          <rect x={stem(on) - 1.2} y={cy - 30} width={1.6} height={29} />
        </g>
      ))}
      <g fill={ink}>
        <rect x={stem(4) - 1.2} y={cy - 30} width={stem(6) - stem(4) + 0.4} height={4.5} />
        <rect x={stem(8) - 1.2} y={cy - 30} width={stem(11) - stem(8) + 0.4} height={4.5} />
        <rect x={stem(8) - 1.2} y={cy - 23} width={stem(11) - stem(8) + 0.4} height={4.5} />
      </g>
      {at.map((on) => (
        <circle key={on} cx={x(on)} cy={98} r={3.4} fill="#e0aa45" />
      ))}
    </CoverFrame>
  );
}

const GAMES: Game[] = [
  {
    path: "/jogos/que-nota",
    title: "Que nota é essa?",
    summary:
      "Aparece uma nota na pauta e você toca no nome dela. Começa dentro da pauta e vai até as linhas suplementares.",
    cover: <NoteCover />,
    progress: () => {
      const m = normalizeNotes(noteGame.get());
      return m.tick === 0 ? null : `Nível ${noteLevel(m)} · ${m.introduced} de ${NOTES.length} notas`;
    },
  },
  {
    path: "/jogos/ritmo",
    title: "Bate o ritmo",
    summary:
      "O metrônomo conta 4, 3, 2, 1 e você toca no ataque de cada nota. Das semínimas às semicolcheias, em cinco níveis.",
    cover: <RhythmCover />,
    progress: () => {
      const m = normalizeRhythm(rhythmGame.get());
      return m.tick === 0 ? null : `Nível ${rhythmLevel(m)} · ${m.introduced} de ${CELLS.length} ritmos`;
    },
  },
];

/** /jogos: vitrine dos jogos */
export function GamesPage() {
  usePageView("stabat · Jogos");
  return (
    <>
      <TopBar />
      <div className="bg-navy px-4 pt-6 pb-[70px] text-[#f3eee4]">
        <div className="mx-auto max-w-[1200px] px-4">
          <h1 className="text-[clamp(26px,5vw,38px)]">Jogos</h1>
          <p className="mt-2 max-w-[560px] opacity-75">
            Leitura e ritmo para treinar brincando, alguns minutos por dia. O jogo lembra onde você parou.
          </p>
        </div>
      </div>
      <main className="mx-auto -mt-12 mb-16 max-w-[1200px] px-4">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {GAMES.map((g) => {
            const progress = g.progress();
            return (
              <article
                key={g.path}
                data-testid="game-card"
                className="relative flex flex-col overflow-hidden rounded-[14px] border border-line bg-surface shadow-card transition hover:-translate-y-0.5 hover:border-accent focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
              >
                {g.cover}
                <div className="flex flex-1 flex-col gap-2 px-4 pt-3 pb-4">
                  <h2 className="text-[22px] leading-tight">
                    <Link
                      to={g.path}
                      className="no-underline outline-none after:absolute after:inset-0 after:z-[1]"
                    >
                      {g.title}
                    </Link>
                  </h2>
                  <p className="text-[14px] text-muted">{g.summary}</p>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-[13px]">
                    <span
                      className={progress ? "text-muted" : "font-semibold text-ok"}
                      data-testid="game-progress"
                    >
                      {progress ?? "Novo"}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-accent">
                      {progress ? "Continuar" : "Jogar"} <ArrowIcon className="size-3.5" />
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </>
  );
}
