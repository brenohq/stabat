import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Engine } from "../audio/engine";
import type { SmellRange } from "../lib/smells";
import type { Timeline } from "../lib/timeline";
import { ScoreView } from "../score/scoreView";
import { PHONE_MAX, layoutFor, scaleFor, stripAbbreviations, type ScaleSteps } from "../score/sizing";
import { Spinner } from "./ui";

interface Props {
  url: string;
  steps: ScaleSteps;
  zoom: number;
  /** no celular, nome do instrumento só no 1º sistema */
  stripAbbrevOnPhone?: boolean;
  muted?: Set<number>;
  /** índice da parte do músico: pauta realçada */
  mine?: number | null;
  loop?: [number, number] | null;
  /** realça em vermelho as notas fora desta extensão (página /smells) */
  smells?: SmellRange | null;
  engine: Engine | null;
  timeline: Timeline;
  onMeasureClick: (m: number) => void;
  onView?: (view: ScoreView | null) => void;
}

export function Score({
  url,
  steps,
  zoom,
  stripAbbrevOnPhone,
  muted,
  mine,
  loop,
  smells,
  engine,
  timeline,
  onMeasureClick,
  onView,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ScoreView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const live = useRef({ zoom, onMeasureClick, steps });
  useLayoutEffect(() => {
    live.current = { zoom, onMeasureClick, steps };
  });

  useEffect(() => {
    const el = host.current!;
    const v = new ScoreView(el, {
      scale: (w) => scaleFor(w, live.current.steps, live.current.zoom),
      layout: layoutFor,
      transform: stripAbbrevOnPhone
        ? (xml) => (innerWidth < PHONE_MAX ? stripAbbreviations(xml) : xml)
        : undefined,
      onMeasureClick: (m) => live.current.onMeasureClick(m),
    });
    v.bottomInset = () => document.querySelector<HTMLElement>("[data-testid=bottom-bar]")?.offsetHeight ?? 0;
    let alive = true;
    v.load(url).then(
      () => alive && setView(v),
      (e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
      v.dispose();
      setView(null);
    };
  }, [url, stripAbbrevOnPhone]);

  useEffect(() => onView?.(view), [view, onView]);
  useEffect(() => view?.relayout(true), [view, zoom]);
  useEffect(() => view?.setMuted(muted ?? new Set()), [view, muted]);
  useEffect(() => view?.setLoop(loop ?? null), [view, loop]);
  useEffect(() => view?.setMine(mine ?? null), [view, mine]);
  useEffect(() => view?.setSmells(smells ?? null), [view, smells]);

  // posição de execução → destaque do compasso e das notas, sem re-renderizar o React
  useEffect(() => {
    if (!view || !engine) return;
    const upd = () => {
      const { m, frac } = timeline.at(engine.now());
      view.highlight(m, engine.playing);
      if (engine.playing) view.markPlaying(m, frac);
      else view.clearPlaying();
    };
    upd();
    return engine.subscribe(upd);
  }, [view, engine, timeline]);

  return (
    <div className="rounded-[10px] bg-paper p-1 text-paper-ink">
      {error && <p className="p-6 text-sm text-red-700">Não foi possível mostrar a partitura: {error}</p>}
      {!view && !error && <Spinner label="Carregando partitura…" />}
      {/* sempre visível: o Verovio precisa da largura real para diagramar */}
      <div ref={host} className="score" data-testid="score" />
    </div>
  );
}
