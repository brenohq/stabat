import { href, pageTitle } from "../lib/collections";
import { usePageView } from "../hooks/usePageView";
import { useCollection } from "../hooks/useCollection";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { BottomBar, Clock, RewindButton, SpeedSelect } from "../components/BottomBar";
import { Mixer } from "../components/Mixer";
import { PlayerLayout } from "../components/PlayerLayout";
import { PlayButton } from "../components/PlayButton";
import { PrintDialog } from "../components/PrintDialog";
import { Score } from "../components/Score";
import { useZoom } from "../hooks/useZoom";
import { TopBar } from "../components/TopBar";
import { ZoomControls } from "../components/ZoomControls";
import { ArrowIcon, MetronomeIcon, PrinterIcon } from "../components/icons";
import { Button, Card, Spinner } from "../components/ui";
import { btnClass } from "../components/btnClass";
import { exposeDebug } from "../debug";
import { useAsync } from "../hooks/useAsync";
import { useEngineValue, useSpaceToggle } from "../hooks/useEngine";
import { usePlayer } from "../hooks/usePlayer";
import { assetUrl, fetchMeta } from "../lib/data";
import { fmtTime } from "../lib/format";
import { partGain } from "../lib/mix";
import { sectionAt } from "../lib/parts";
import { myPartOf } from "../lib/storage";
import { Timeline } from "../lib/timeline";
import type { ArrangementMeta } from "../lib/types";
import { SCORE_SCALE } from "../score/sizing";
import type { ScoreView } from "../score/scoreView";
import { NotFound } from "./NotFound";

export function ArrangementPage() {
  const { arranjoId = "" } = useParams();
  const col = useCollection();
  const state = useAsync(() => fetchMeta(col, arranjoId), [col.id, arranjoId]);
  if (state.status === "loading")
    return (
      <>
        <TopBar />
        <Spinner label="Carregando arranjo…" />
      </>
    );
  if (state.status === "error") return <NotFound message="Arranjo não encontrado." />;
  return <Arrangement key={arranjoId} meta={state.data} />;
}

function Arrangement({ meta }: { meta: ArrangementMeta }) {
  const col = useCollection();
  const timeline = useMemo(() => new Timeline(meta.timeline, meta.duration), [meta]);
  // 18 partes decodificadas pesam: 32 kHz basta para estudo e economiza memória no celular
  const urls = useMemo(() => meta.parts.map((p) => assetUrl(col, meta, `audio/${p.id}.mp3`)), [meta]);
  const { engine, progress, error } = usePlayer(timeline, urls, { sampleRate: 32000 });
  const [on, setOn] = useState(() => new Set(meta.parts.map((p) => p.index)));
  const [solo, setSolo] = useState(() => new Set<number>());
  const [drawer, setDrawer] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [zoom, zoomIn, zoomOut] = useZoom();
  const [view, setView] = useState<ScoreView | null>(null);
  const mine = myPartOf(col).get();
  const myInThis = mine && meta.parts.find((p) => p.id === mine.id);

  const loaded = useEngineValue(engine, (e) => e.loaded, false);
  const playing = useEngineValue(engine, (e) => e.playing, false);
  const second = useEngineValue(engine, (e) => Math.floor(e.now() / 1000), 0);
  const measure = useEngineValue(engine, (e) => timeline.at(e.now()).m, 0);
  const rate = useEngineValue(engine, (e) => e.rate, 1);
  const metronome = useEngineValue(engine, (e) => e.metronome, true);
  useSpaceToggle(engine);

  const muted = useMemo(
    () => new Set(meta.parts.map((p) => p.index).filter((i) => partGain(i, on, solo) === 0)),
    [meta, on, solo],
  );
  useEffect(() => {
    if (!engine || !loaded) return;
    meta.parts.forEach((p) => engine.setGain(p.index, partGain(p.index, on, solo)));
  }, [engine, loaded, meta, on, solo]);

  useEffect(() => {
    exposeDebug("page", engine ? { engine, timeline, meta, view } : null);
    return () => exposeDebug("page", null);
  }, [engine, timeline, meta, view]);
  usePageView(pageTitle(col, meta.title));

  const onMeasureClick = useCallback((m: number) => engine?.loaded && engine.seekMeasure(m), [engine]);
  const curSection = (() => {
    let c: number | null = null;
    for (const mk of meta.marks) if (mk.m <= measure) c = mk.m;
    return c;
  })();

  return (
    <PlayerLayout
      bar={
        <BottomBar
          wide
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
              <div className="flex flex-wrap gap-1 max-sm:w-full" data-testid="sections">
                {meta.marks.map((mk) => (
                  <button
                    key={mk.m}
                    type="button"
                    title={`Ensaio ${mk.label} (c. ${mk.m + 1})`}
                    onClick={() => {
                      const k = timeline.first(mk.m);
                      if (k !== null && engine?.loaded) engine.seek(timeline.startOf(k), { autoplay: true });
                    }}
                    className={`size-8 cursor-pointer rounded-lg border font-display font-semibold ${
                      curSection === mk.m
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-line bg-surface"
                    }`}
                  >
                    {mk.label}
                  </button>
                ))}
              </div>
            </>
          }
          bottom={
            <>
              {error && <span className="text-xs text-red-700">{error}</span>}
              <span className="flex-1 max-sm:hidden" />
              <Button
                id="metro"
                title="Metrônomo"
                on={metronome}
                onClick={() => engine?.setMetronome(!metronome)}
              >
                <MetronomeIcon /> <span className="max-sm:sr-only">Metrônomo</span>
              </Button>
              <Button
                className="min-[901px]:hidden"
                onClick={() => setDrawer((d) => !d)}
                aria-expanded={drawer}
              >
                Instrumentos
              </Button>
              {myInThis && (
                <Link
                  to={href(col, meta.id, myInThis.id)}
                  className={btnClass({ primary: true })}
                  data-testid="study-mine"
                >
                  Minha parte <ArrowIcon />
                </Link>
              )}
            </>
          }
        />
      }
    >
      <TopBar
        crumbs={
          <>
            <Link to={href(col)}>{col.crumb}</Link> / <span>{meta.title}</span>
          </>
        }
      />
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 pt-4.5 pb-2.5">
        <h1 className="text-[28px]">{meta.title}</h1>
        <span className="text-sm text-muted">
          {meta.subtitle} · {meta.time} · {meta.tempo} bpm
        </span>
        <span className="flex-1" />
        <Button className="max-[900px]:hidden" onClick={() => setPrinting(true)} data-testid="print-open">
          <PrinterIcon /> Imprimir partes
        </Button>
      </div>

      <div className="mx-auto grid max-w-[1400px] items-start gap-4 px-4 pt-3.5 pb-6 min-[901px]:grid-cols-[1fr_300px]">
        <Card className="min-h-[60vh] overflow-hidden">
          <Score
            url={assetUrl(col, meta, "score.musicxml")}
            steps={SCORE_SCALE}
            zoom={zoom}
            muted={muted}
            mine={myInThis ? myInThis.index : null}
            engine={engine}
            timeline={timeline}
            onMeasureClick={onMeasureClick}
            onView={setView}
          />
        </Card>
        <aside
          data-testid="mixer-panel"
          data-open={drawer}
          className={`overflow-auto rounded-[14px] border border-line bg-surface py-1.5 shadow-card min-[901px]:sticky min-[901px]:top-4 min-[901px]:max-h-[calc(100dvh-var(--barh,130px)-32px)] max-[900px]:fixed max-[900px]:inset-x-0 max-[900px]:bottom-[var(--barh,0px)] max-[900px]:z-30 max-[900px]:max-h-[70vh] max-[900px]:rounded-b-none max-[900px]:transition-[transform,visibility] ${
            drawer
              ? "max-[900px]:visible max-[900px]:translate-y-0 max-[900px]:shadow-[0_-10px_40px_rgb(0_0_0/0.25)]"
              : "max-[900px]:invisible max-[900px]:translate-y-[calc(100%+var(--barh,0px)+20px)]"
          }`}
        >
          <div className="flex items-center justify-between px-3.5 pt-2 pb-1.5">
            <h2 className="text-base">Instrumentos</h2>
            <span className="text-[13px] text-accent [&_button]:cursor-pointer [&_button]:px-1">
              <button
                type="button"
                onClick={() => (setOn(new Set(meta.parts.map((p) => p.index))), setSolo(new Set()))}
              >
                todos
              </button>
              <button type="button" onClick={() => (setOn(new Set()), setSolo(new Set()))}>
                nenhum
              </button>
            </span>
          </div>
          <Mixer
            arrangementId={meta.id}
            parts={meta.parts}
            on={on}
            solo={solo}
            myPartId={mine?.id ?? null}
            onChange={(o, s) => {
              setOn(o);
              setSolo(s);
            }}
          />
          <p className="px-3.5 pt-2.5 pb-1 text-xs text-muted">
            Clique num compasso para tocar a partir dele. "S" toca só aquele instrumento. Barra de espaço:
            tocar/pausar.
          </p>
        </aside>
      </div>

      <PrintDialog meta={meta} open={printing} onClose={() => setPrinting(false)} />
    </PlayerLayout>
  );
}
