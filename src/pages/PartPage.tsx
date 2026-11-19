import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { PartPicker } from "../components/PartPicker";
import { BottomBar, Clock, RewindButton, SpeedSelect } from "../components/BottomBar";
import { PlayButton } from "../components/PlayButton";
import { Score } from "../components/Score";
import { SmellPanel } from "../components/SmellPanel";
import { useZoom } from "../hooks/useZoom";
import { TopBar } from "../components/TopBar";
import { ZoomControls } from "../components/ZoomControls";
import { BackIcon, LoopIcon, MetronomeIcon } from "../components/icons";
import { Button, Card, Spinner } from "../components/ui";
import { exposeDebug } from "../debug";
import { useAsync } from "../hooks/useAsync";
import { useEngineValue, useSpaceToggle, useWakeLock } from "../hooks/useEngine";
import { usePlayer } from "../hooks/usePlayer";
import { assetUrl, fetchMeta } from "../lib/data";
import { fmtTime } from "../lib/format";
import { DEFAULT_PART_MIX, matchGains, mixGains, mixLevels } from "../lib/mix";
import { sectionAt, shortName } from "../lib/parts";
import { pitchName, smellRange, smellReport, type SmellRange, type SmellReport } from "../lib/smells";
import { myPart } from "../lib/storage";
import { Timeline } from "../lib/timeline";
import type { ArrangementMeta, Part } from "../lib/types";
import { PART_SCALE } from "../score/sizing";
import type { ScoreView } from "../score/scoreView";
import { NotFound } from "./NotFound";

export function PartPage({ smells = false }: { smells?: boolean }) {
  const { arranjoId = "", parteId = "" } = useParams();
  const state = useAsync(() => fetchMeta(arranjoId), [arranjoId]);
  if (state.status === "loading")
    return (
      <>
        <TopBar />
        <Spinner label="Carregando parte…" />
      </>
    );
  if (state.status === "error") return <NotFound message="Arranjo não encontrado." />;
  const part = state.data.parts.find((p) => p.id === parteId);
  if (!part) return <NotFound message="Esta parte não existe neste arranjo." />;
  return <PartStudy key={`${arranjoId}/${parteId}`} meta={state.data} part={part} smells={smells} />;
}

const PRESETS = [
  { label: "Com banda", value: DEFAULT_PART_MIX },
  { label: "Só banda", value: 0 },
  { label: "Só minha parte", value: 100 },
];

/** seleção do trecho para repetir: escolhendo o 1º compasso, o último, ou pronto */
type LoopSel = null | { a: number | null; b?: undefined } | { a: number; b: number };

function PartStudy({ meta, part, smells }: { meta: ArrangementMeta; part: Part; smells: boolean }) {
  const navigate = useNavigate();
  const timeline = useMemo(() => new Timeline(meta.timeline, meta.duration), [meta]);
  // [0] minha parte, [1] banda sem a minha parte
  const urls = useMemo(
    () => [assetUrl(meta, `audio/${part.id}.mp3`), assetUrl(meta, `audio/sem-${part.id}.mp3`)],
    [meta, part],
  );
  const { engine, progress, error } = usePlayer(timeline, urls);
  const [mix, setMix] = useState(DEFAULT_PART_MIX);
  const [loopSel, setLoopSel] = useState<LoopSel>(null);
  const [zoom, zoomIn, zoomOut] = useZoom();
  const [view, setView] = useState<ScoreView | null>(null);

  const loaded = useEngineValue(engine, (e) => e.loaded, false);
  const playing = useEngineValue(engine, (e) => e.playing, false);
  const second = useEngineValue(engine, (e) => Math.floor(e.now() / 1000), 0);
  const measure = useEngineValue(engine, (e) => timeline.at(e.now()).m, 0);
  const rate = useEngineValue(engine, (e) => e.rate, 1);
  const metronome = useEngineValue(engine, (e) => e.metronome, true);
  const countIn = useEngineValue(engine, (e) => e.countIn, false);
  useSpaceToggle(engine);
  useWakeLock(playing);

  // escolher (ou abrir) uma parte grava como "minha parte"; revisar smells não conta
  useEffect(() => {
    if (!smells) myPart.set({ id: part.id, name: part.name });
  }, [part, smells]);
  useEffect(() => {
    document.title = `stabat · ${smells ? "smells · " : ""}${part.name} · ${meta.title}`;
  }, [meta, part, smells]);
  const goToMeasure = (m: number) => {
    engine?.seekMeasure(m);
    view?.highlight(m, false);
    view?.scrollTo(m);
  };
  const range = useMemo(() => (smells ? smellRange(part.name) : null), [smells, part]);
  const report = useMemo(() => (range && view ? smellReport(view.notes(), range) : null), [range, view]);
  // iguala o volume da parte ao da banda uma vez por carregamento
  const match = useMemo(
    () => (engine && loaded ? matchGains(engine.loudness(0), engine.loudness(1)) : undefined),
    [engine, loaded],
  );
  useEffect(() => {
    if (!engine || !loaded) return;
    const g = mixGains(mix, match);
    engine.setGain(0, g.me);
    engine.setGain(1, g.band);
  }, [engine, loaded, mix, match]);
  useEffect(() => {
    exposeDebug("page", engine ? { engine, timeline, meta, view, part } : null);
    return () => exposeDebug("page", null);
  }, [engine, timeline, meta, view, part]);

  const picking = loopSel !== null && loopSel.b === undefined;
  const loopRange: [number, number] | null =
    loopSel === null
      ? null
      : loopSel.b !== undefined
        ? [loopSel.a, loopSel.b]
        : loopSel.a !== null
          ? [loopSel.a, loopSel.a]
          : null;

  const onMeasureClick = useCallback(
    (m: number) => {
      if (!engine?.loaded) return;
      if (loopSel && loopSel.b === undefined) {
        if (loopSel.a === null) return setLoopSel({ a: m });
        const a = Math.min(loopSel.a, m);
        const b = Math.max(loopSel.a, m);
        setLoopSel({ a, b });
        engine.setLoop(timeline.range(a, b, engine.now()));
        if (!engine.playing) void engine.play();
        return;
      }
      engine.seekMeasure(m);
      if (!engine.loop && loopSel) setLoopSel(null); // clicou fora do trecho: sai do loop
    },
    [engine, loopSel, timeline],
  );

  const toggleLoop = () => {
    if (loopSel) {
      setLoopSel(null);
      engine?.setLoop(null);
    } else setLoopSel({ a: null });
  };

  const levels = mixLevels(mix);
  const beatsInFirst = meta.timeline[0]?.beats ?? 4;

  return (
    <>
      <TopBar
        crumbs={
          <>
            <Link to="/">Repertório</Link> / <Link to={`/${meta.id}`}>{meta.title}</Link> /{" "}
            <span>{shortName(part.name)}</span>
          </>
        }
      />
      <main
        className={`mx-auto px-4 pt-4 pb-[calc(var(--barh,190px)+24px)] ${
          smells
            ? "grid max-w-[1400px] items-start gap-x-4 min-[1100px]:grid-cols-[minmax(0,1fr)_280px]"
            : "max-w-[1060px]"
        }`}
      >
        <div className="min-w-0">
          <div className="mb-3.5 flex flex-wrap items-center gap-3.5">
            <Link
              to={`/${meta.id}`}
              title="Voltar ao arranjo"
              aria-label="Voltar ao arranjo"
              className="grid size-9 place-items-center rounded-[10px] border border-line bg-surface"
            >
              <BackIcon className="size-[18px]" />
            </Link>
            <div className="min-w-[200px] flex-1">
              <h1 className="text-[28px] leading-tight">{part.name}</h1>
              <div className="text-sm text-muted">
                {meta.title} · {meta.time} · {meta.tempo} bpm
              </div>
            </div>
            <PartPicker
              id="switch"
              label="Trocar parte"
              parts={meta.parts}
              value={part.id}
              onChange={(id) => {
                const p = meta.parts.find((x) => x.id === id);
                if (!p) return;
                if (smells) return void navigate(`/${meta.id}/${p.id}/smells`);
                myPart.set({ id: p.id, name: p.name });
                void navigate(`/${meta.id}/${p.id}`);
              }}
              className="w-full sm:w-[240px]"
            />
          </div>
          {smells && (
            <div className="min-[1100px]:hidden">
              <SmellSummary range={range!} report={report} onMeasure={goToMeasure} />
            </div>
          )}
          <Card className="overflow-hidden p-1.5">
            <Score
              url={assetUrl(meta, `parts/${part.id}.musicxml`)}
              steps={PART_SCALE}
              zoom={zoom}
              stripAbbrevOnPhone
              loop={loopRange}
              smells={range}
              engine={engine}
              timeline={timeline}
              onMeasureClick={onMeasureClick}
              onView={setView}
            />
          </Card>
        </div>
        {smells && (
          <div className="max-[1099px]:hidden">
            <SmellPanel meta={meta} part={part} range={range!} report={report} onMeasure={goToMeasure} />
          </div>
        )}
      </main>

      {picking && (
        <div
          className="fixed bottom-[calc(var(--barh,150px)+16px)] left-1/2 z-25 -translate-x-1/2 rounded-full bg-ink px-3.5 py-2 text-[13px] text-bg"
          role="status"
        >
          {loopSel.a === null
            ? "Clique no primeiro compasso do trecho"
            : "Agora clique no último compasso do trecho"}
        </div>
      )}

      <BottomBar
        top={
          <>
            <div className="flex items-center gap-2">
              <PlayButton
                playing={playing}
                progress={loaded ? null : progress}
                onClick={() => engine?.toggle()}
              />
              <RewindButton onClick={() => engine?.stop()} />
              <ZoomControls onIn={zoomIn} onOut={zoomOut} />
              <Clock
                measure={measure + 1}
                section={sectionAt(meta.marks, measure)}
                seconds={fmtTime(second)}
                duration={fmtTime(meta.duration)}
              />
            </div>
            <SpeedSelect rate={rate} onChange={(r) => void engine?.setRate(r)} />
            <div className="grid min-w-[240px] flex-1 grid-cols-[auto_1fr_auto] items-center gap-2.5 text-xs text-muted max-sm:basis-full">
              <div className="flex flex-col items-center leading-tight">
                <b className="text-[13px] font-semibold text-ink" data-testid="level-band">
                  {Math.round(levels.band * 100)}%
                </b>
                banda
              </div>
              <input
                id="mix"
                type="range"
                min={0}
                max={100}
                value={mix}
                onChange={(e) => setMix(Number(e.target.value))}
                aria-label="Equilíbrio entre a banda e a minha parte"
                className="w-full"
              />
              <div className="flex flex-col items-center leading-tight">
                <b className="text-[13px] font-semibold text-ink" data-testid="level-me">
                  {Math.round(levels.me * 100)}%
                </b>
                minha parte
              </div>
            </div>
          </>
        }
        bottom={
          <>
            <div
              className="inline-flex overflow-hidden rounded-[10px] border border-line"
              role="group"
              aria-label="Atalhos de volume"
            >
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  aria-pressed={mix === p.value}
                  onClick={() => setMix(p.value)}
                  className={`cursor-pointer border-r border-line px-2.5 py-1.5 text-[13px] last:border-r-0 ${
                    mix === p.value ? "bg-accent-soft font-semibold" : "bg-surface"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {error && <span className="text-xs text-red-700">{error}</span>}
            <div className="ml-auto flex flex-wrap justify-end gap-2">
              <Button
                id="metro"
                title="Metrônomo"
                on={metronome}
                onClick={() => engine?.setMetronome(!metronome)}
              >
                <MetronomeIcon /> <span className="max-sm:sr-only">Metrônomo</span>
              </Button>
              <Button
                id="count"
                on={countIn}
                title="Conta um compasso antes de começar"
                onClick={() => engine?.setCountIn(!countIn)}
              >
                {Array.from({ length: beatsInFirst }, (_, i) => i + 1).join(" ")}
              </Button>
              <Button id="loop" on={loopSel !== null} onClick={toggleLoop}>
                <LoopIcon />
                {loopSel?.b !== undefined
                  ? ` c. ${loopSel.a + 1}–${loopSel.b + 1} ✕`
                  : loopSel
                    ? " Escolhendo… ✕"
                    : " Repetir trecho"}
              </Button>
            </div>
          </>
        }
      />
    </>
  );
}

/** resumo da página /smells: quantas notas fora da extensão e em quais compassos */
function SmellSummary({
  range: r,
  report,
  onMeasure,
}: {
  range: SmellRange;
  report: SmellReport | null;
  onMeasure: (m: number) => void;
}) {
  const range = `acima do ${pitchName(r.high)} ou abaixo do ${pitchName(r.low)} (escrito)`;
  return (
    <div
      data-testid="smells"
      className="mb-3.5 rounded-[14px] border border-[#d62828]/40 bg-[#d62828]/[0.07] px-4 py-3 text-sm"
    >
      <b className="text-[#b01f1f]">Smells</b> · notas {range}
      <div className="mt-1.5">
        {!report ? (
          <span className="text-muted">Analisando a partitura…</span>
        ) : report.measures.length === 0 ? (
          <span data-testid="smells-count">Nenhuma nota fora da extensão. 👌</span>
        ) : (
          <>
            <span data-testid="smells-count">
              {report.high + report.low} {report.high + report.low === 1 ? "nota" : "notas"} ({report.high}{" "}
              {report.high === 1 ? "aguda" : "agudas"}, {report.low} {report.low === 1 ? "grave" : "graves"})
              em {report.measures.length} {report.measures.length === 1 ? "compasso" : "compassos"}:
            </span>{" "}
            <span className="inline-flex flex-wrap gap-1 align-middle">
              {report.measures.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onMeasure(m)}
                  className="cursor-pointer rounded-md border border-[#d62828]/40 bg-surface px-1.5 text-[13px] font-semibold text-[#b01f1f]"
                >
                  {m + 1}
                </button>
              ))}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
