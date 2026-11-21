import { Link } from "react-router";
import { TopBar } from "../components/TopBar";
import { Card } from "../components/ui";
import { ArrowIcon } from "../components/icons";
import { StudyInstrumentPicker } from "../components/studies/StudyInstrumentPicker";
import { usePageView } from "../hooks/usePageView";
import { useStudyInstrument } from "../hooks/useStudyInstrument";
import { LESSONS, type Lesson } from "../lib/studies/lessons";
import { chromaticNotes } from "../lib/studies/scales";

/** capa do cartão: a primeira escala da lição subindo na pauta (na cromática, Dó a Dó de semitom em semitom) */
function Cover({ lesson }: { lesson: Lesson }) {
  const chromatic = lesson.kind === "chromatic";
  const notes = chromatic ? chromaticNotes(60, 72) : lesson.scales[0]!.notes;
  const gap = chromatic ? 18 : 30;
  const y = (step: number) => 66 - step * 4.5;
  const hue = chromatic ? [170, 215] : lesson.mode === "major" ? [40, 220] : [260, 205];
  return (
    <div className="relative h-28 overflow-hidden">
      <svg
        viewBox="0 0 400 112"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
        className="absolute inset-0 size-full"
      >
        <defs>
          <linearGradient id={`study-${lesson.id}`} x1="0" x2="1">
            <stop offset="0" stopColor={`hsl(${hue[0]} 45% 38%)`} />
            <stop offset="1" stopColor={`hsl(${hue[1]} 45% 26%)`} />
          </linearGradient>
        </defs>
        <rect width="400" height="112" fill={`url(#study-${lesson.id})`} />
        {[0, 2, 4, 6, 8].map((s) => (
          <line key={s} x1="0" x2="400" y1={y(s)} y2={y(s)} stroke="rgb(255 255 255 / .22)" />
        ))}
        {notes.map((n, i) => (
          <ellipse
            key={n.id}
            cx={150 + i * gap}
            cy={y(n.step)}
            rx={6.4}
            ry={4.6}
            transform={`rotate(-20 ${150 + i * gap} ${y(n.step)})`}
            fill="rgb(255 255 255 / .85)"
          />
        ))}
      </svg>
    </div>
  );
}

/** /estudos: catálogo de lições, que valem para todos os instrumentos */
export function StudiesPage() {
  usePageView("stabat · Estudos");
  const [inst, chooseInst] = useStudyInstrument();
  return (
    <>
      <TopBar />
      <div className="bg-navy px-4 pt-6 pb-[70px] text-[#f3eee4]">
        <div className="mx-auto max-w-[1200px] px-4">
          <h1 className="text-[clamp(26px,5vw,38px)]">Estudos</h1>
          <p className="mt-2 max-w-[560px] opacity-75">
            Exercícios para treinar em casa, com a digitação de cada nota no seu instrumento.
          </p>
        </div>
      </div>
      <main className="mx-auto -mt-12 mb-16 flex max-w-[1200px] flex-col gap-5 px-4">
        <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
          <h2 className="text-lg">Qual é o seu instrumento?</h2>
          <StudyInstrumentPicker
            value={inst}
            onChange={chooseInst}
            label="Qual é o seu instrumento?"
            className="w-full sm:w-[260px]"
          />
          <span className="text-[13px] text-muted">As lições mostram a digitação dele.</span>
        </Card>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {LESSONS.map((l) => (
            <article
              key={l.id}
              data-testid="lesson-card"
              className="relative flex flex-col overflow-hidden rounded-[14px] border border-line bg-surface shadow-card transition hover:-translate-y-0.5 hover:border-accent focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
            >
              <Cover lesson={l} />
              <div className="flex flex-1 flex-col gap-2 px-4 pt-3 pb-4">
                <h2 className="text-[22px] leading-tight">
                  <Link
                    to={`/estudos/${l.id}`}
                    className="no-underline outline-none after:absolute after:inset-0 after:z-[1]"
                  >
                    {l.title}
                  </Link>
                </h2>
                <p className="text-[14px] text-muted">{l.summary}</p>
                <div className="mt-auto flex items-center justify-between pt-1 text-[13px]">
                  <span className="text-muted">
                    {l.kind === "scales" ? `${l.scales.length} escalas · uma oitava` : "toda a extensão"}
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-accent">
                    Começar <ArrowIcon className="size-3.5" />
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
