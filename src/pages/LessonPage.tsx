import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { TopBar } from "../components/TopBar";
import { Button, Card } from "../components/ui";
import { BackIcon } from "../components/icons";
import { ZoomControls } from "../components/ZoomControls";
import { measureFor } from "../components/studies/chromaticLayout";
import { NoteDetail } from "../components/studies/NoteDetail";
import { StudyControls } from "../components/studies/StudyControls";
import { StudyInstrumentPicker } from "../components/studies/StudyInstrumentPicker";
import { StudyStaff } from "../components/studies/StudyStaff";
import { usePageView } from "../hooks/usePageView";
import { useStudyInstrument } from "../hooks/useStudyInstrument";
import { useStudySession, type StudySession } from "../hooks/useStudySession";
import { exposeDebug } from "../debug";
import { rangeOf, type StudyInstrument } from "../lib/fingering/instruments";
import { lessonById, type ChromaticLesson, type Lesson, type ScaleLesson } from "../lib/studies/lessons";
import type { WrittenNote } from "../lib/studies/notes";
import { chromaticPitches, placeScale, type ChromaticPitch, type KeySignature } from "../lib/studies/scales";
import { prefs } from "../lib/storage";
import { NotFound } from "./NotFound";

/** /estudos/:licaoId: escalas (?escala=<id>) ou a escala cromática do instrumento */
export function LessonPage() {
  const { licaoId } = useParams();
  const lesson = lessonById(licaoId);
  if (!lesson) return <NotFound />;
  return lesson.kind === "scales" ? (
    <ScaleLessonView key={lesson.id} lesson={lesson} />
  ) : (
    <ChromaticLessonView key={lesson.id} lesson={lesson} />
  );
}

/** topo, cartão e seletor de instrumento, iguais em todas as lições */
function Shell({
  lesson,
  inst,
  onInstrument,
  children,
  wide,
}: {
  lesson: Lesson;
  inst: StudyInstrument;
  onInstrument: (id: string) => void;
  children: ReactNode;
  wide?: boolean;
}) {
  usePageView(`stabat · ${lesson.title}`);
  const max = wide ? "max-w-[1200px]" : "max-w-[980px]";
  return (
    <>
      <TopBar
        crumbs={
          <>
            <Link to="/estudos">Estudos</Link> › {lesson.title}
          </>
        }
      />
      <div className="bg-navy px-4 pt-5 pb-[70px] text-[#f3eee4]">
        <div className={`mx-auto px-4 ${max}`}>
          <Link
            to="/estudos"
            className="mb-2 inline-flex items-center gap-1 text-[13px] no-underline opacity-75 hover:opacity-100 sm:hidden"
          >
            <BackIcon className="size-3.5" /> Estudos
          </Link>
          <h1 className="text-[clamp(26px,5vw,38px)]">{lesson.title}</h1>
          <p className="mt-2 max-w-[600px] opacity-75">{lesson.summary}</p>
        </div>
      </div>
      <main className={`mx-auto -mt-12 mb-16 px-4 ${max}`}>
        <Card className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <div className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted max-sm:w-full">
              <span aria-hidden>Seu instrumento</span>
              <StudyInstrumentPicker
                value={inst}
                onChange={onInstrument}
                className="w-full text-[15px] font-normal text-ink sm:w-[250px]"
              />
            </div>
            {children}
          </div>
        </Card>
      </main>
    </>
  );
}

function useDebug(
  lesson: Lesson,
  inst: StudyInstrument,
  notes: WrittenNote[],
  s: StudySession,
  extra: Record<string, unknown> = {},
) {
  useEffect(() => {
    exposeDebug("study", {
      state: () => ({
        lesson: lesson.id,
        instrument: inst.id,
        index: s.index,
        note: notes[s.index]?.id,
        count: notes.length,
        playing: s.player.playing,
        sounding: s.piano.sounding(),
        ...extra,
      }),
    });
    return () => exposeDebug("study", null);
  });
}

const sheetClass = "overflow-hidden rounded-xl border border-[#e8e0cf] bg-paper text-paper-ink";

// ---------- lupa (igual em todas as lições) ----------
const desktop = typeof window !== "undefined" ? window.matchMedia?.("(min-width: 640px)") : undefined;
const subscribe = (cb: () => void) => {
  desktop?.addEventListener("change", cb);
  return () => desktop?.removeEventListener("change", cb);
};
const large = typeof window !== "undefined" ? window.matchMedia?.("(min-width: 1024px)") : undefined;
const subscribeLarge = (cb: () => void) => {
  large?.addEventListener("change", cb);
  return () => large?.removeEventListener("change", cb);
};
/** quantos compassos por linha (menos = maior) */
const PER_ROW = [3, 4, 6, 8, 10, 12];

/** lupa dos estudos, lembrada no aparelho; sem escolha, 8 compassos por linha no computador e 4 no celular */
function useStudyZoom() {
  const wide = useSyncExternalStore(subscribe, () => desktop?.matches ?? true);
  const [saved, setSaved] = useState<number | null>(
    () =>
      prefs.get<number | null>("studies.perRow", null) ??
      prefs.get<number | null>("studies.chromaticPerRow", null),
  );
  const perRow = saved && PER_ROW.includes(saved) ? saved : wide ? 8 : 4;
  const step = (d: number) => {
    const next = PER_ROW[Math.max(0, Math.min(PER_ROW.length - 1, PER_ROW.indexOf(perRow) + d))]!;
    setSaved(next);
    prefs.set("studies.perRow", next);
  };
  return { perRow, zoomIn: () => step(-1), zoomOut: () => step(1) };
}

/**
 * O quadro de uma lição (o padrão visual dos estudos): as linhas de pauta e a nota da vez —
 * ao lado no computador (lg) e presa no topo da tela, com altura fixa, até o lg.
 */
function StudyBoard({
  pitches,
  inst,
  s,
  perRow,
  signature,
  signatureSlots,
  frame,
  accidentals,
  colorNames = true,
}: {
  pitches: ChromaticPitch[];
  inst: StudyInstrument;
  s: StudySession;
  perRow: number;
  signature?: KeySignature;
  signatureSlots?: number;
  frame?: { top: number; bottom: number };
  accidentals?: boolean;
  colorNames?: boolean;
}) {
  const rows = useMemo(() => {
    const out: ChromaticPitch[][] = [];
    for (let i = 0; i < pitches.length; i += perRow) out.push(pitches.slice(i, i + perRow));
    return out;
  }, [pitches, perRow]);
  const measure = measureFor(pitches);
  const pitch = pitches[s.index]!;
  const prev = s.index > 0 ? pitches[s.index - 1]!.spellings[0]! : null;
  const detail = (layout: "side" | "compact") => (
    <NoteDetail
      inst={inst}
      note={pitch.spellings[0]!}
      alt={pitch.spellings[1]}
      prev={prev}
      layout={layout}
      colored={colorNames}
    />
  );
  // só um painel da nota da vez no DOM: ao lado (lg) ou preso no topo
  const side = useSyncExternalStore(subscribeLarge, () => large?.matches ?? true);
  return (
    <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      {!side && (
        <div className={`${sheetClass} sticky top-0 z-10 px-3 py-3 shadow-card`} data-testid="note-sticky">
          {detail("compact")}
        </div>
      )}
      <div className={sheetClass} data-testid="study-sheet">
        {rows.map((row, r) => (
          <div key={r} className="border-b border-[#e8e0cf] px-2 pt-2 last:border-b-0 sm:px-4">
            <StudyStaff
              row={row}
              measure={measure}
              contentWidth={perRow * measure}
              signature={signature}
              signatureSlots={signatureSlots}
              accidentals={accidentals}
              frame={frame}
              last={r === rows.length - 1}
              mechanism={inst.mechanism}
              current={s.index - r * perRow}
              onSelect={(i) => s.select(r * perRow + i)}
              label={`Notas ${r * perRow + 1} a ${r * perRow + row.length}`}
              follow={s.player.playing}
            />
          </div>
        ))}
      </div>
      {side && <div className={`${sheetClass} sticky top-4 px-5 py-5`}>{detail("side")}</div>}
    </div>
  );
}

// ---------- escalas ----------
function ScaleLessonView({ lesson }: { lesson: ScaleLesson }) {
  const [params, setParams] = useSearchParams();
  const [inst, chooseInst] = useStudyInstrument();
  // cada escala na oitava que cabe no instrumento (a tuba toca Lá e Si uma oitava abaixo)
  const placed = useMemo(() => lesson.scales.map((sc) => placeScale(sc, ...rangeOf(inst))!), [lesson, inst]);
  const scale = placed.find((sc) => sc.id === params.get("escala")) ?? placed[0]!;
  const s = useStudySession(scale.notes);
  const { perRow, zoomIn, zoomOut } = useStudyZoom();
  const pitches = useMemo(() => scale.notes.map((n) => ({ midi: n.midi, spellings: [n] })), [scale]);
  // moldura fixa da lição inteira: trocar de escala não mexe a pauta (armadura e altura)
  const signatureSlots = Math.max(...placed.map((sc) => sc.signature.steps.length));
  const frame = useMemo(() => {
    const steps = placed.flatMap((sc) => sc.notes.map((n) => n.step));
    return {
      top: Math.max(10, ...steps.map((x) => x + 2)),
      bottom: Math.min(-2, ...steps.map((x) => x - 2)),
    };
  }, [placed]);
  useDebug(lesson, inst, scale.notes, s, { scale: scale.id, perRow });

  const chooseScale = (id: string) => {
    s.reset();
    setParams(id === placed[0]!.id ? {} : { escala: id }, { replace: true });
  };
  return (
    <Shell
      lesson={lesson}
      inst={inst}
      wide
      onInstrument={(id) => {
        s.player.stop();
        chooseInst(id);
      }}
    >
      <div className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted">
        <span aria-hidden>Escala</span>
        <div role="radiogroup" aria-label="Escala" className="flex flex-wrap gap-1.5">
          {placed.map((sc) => (
            <Button
              key={sc.id}
              role="radio"
              aria-checked={sc.id === scale.id}
              aria-pressed={undefined}
              aria-label={sc.label}
              on={sc.id === scale.id}
              onClick={() => chooseScale(sc.id)}
              className="min-w-[46px] !text-[14px]"
            >
              {sc.notes[0]!.name}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2">
        <StudyControls s={s} playLabel="Tocar a escala" />
        <ZoomControls onIn={zoomIn} onOut={zoomOut} />
      </div>
      <StudyBoard
        pitches={pitches}
        inst={inst}
        s={s}
        perRow={perRow}
        signature={scale.signature}
        signatureSlots={signatureSlots}
        frame={frame}
      />
      {inst.mechanism === "recorder" && <RecorderNote />}
    </Shell>
  );
}

// ---------- cromática ----------
function ChromaticLessonView({ lesson }: { lesson: ChromaticLesson }) {
  const [inst, chooseInst] = useStudyInstrument();
  const pitches = useMemo(() => chromaticPitches(...rangeOf(inst)), [inst]);
  // a sessão anda pela grafia com sustenido; a com bemol aparece ao lado
  const notes = useMemo(() => pitches.map((p) => p.spellings[0]!), [pitches]);
  const s = useStudySession(notes);
  const { perRow, zoomIn, zoomOut } = useStudyZoom();
  useDebug(lesson, inst, notes, s, { perRow });
  const nameOf = (p: ChromaticPitch) =>
    `${p.spellings.map((n) => n.name).join("/")}${p.spellings[0]!.octave}`;
  return (
    <Shell
      lesson={lesson}
      inst={inst}
      wide
      onInstrument={(id) => {
        s.reset();
        chooseInst(id);
      }}
    >
      <p className="text-sm text-muted sm:pb-2.5" data-testid="chromatic-range">
        {pitches.length} notas, de {nameOf(pitches[0]!)} a {nameOf(pitches.at(-1)!)}
      </p>
      <div className="flex w-full flex-wrap items-center gap-2">
        <StudyControls s={s} playLabel="Tocar todas" />
        <ZoomControls onIn={zoomIn} onOut={zoomOut} />
      </div>
      <StudyBoard pitches={pitches} inst={inst} s={s} perRow={perRow} accidentals />
      {inst.mechanism === "recorder" && <RecorderNote />}
    </Shell>
  );
}

function RecorderNote() {
  return (
    <p className="text-[13px] text-muted">
      Flauta doce soprano, dedilhado barroco. A música escrita soa uma oitava acima.
    </p>
  );
}
