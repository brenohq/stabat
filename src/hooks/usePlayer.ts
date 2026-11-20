import { useEffect, useState } from "react";
import { Engine, type EngineOptions, type Track } from "../audio/engine";
import type { Timeline } from "../lib/timeline";

/** cria o motor de áudio e libera tudo ao sair da página (as fontes vêm de useTracks) */
export function usePlayer(timeline: Timeline | null, opts: EngineOptions = {}): Engine | null {
  const [engine, setEngine] = useState<Engine | null>(null);
  const rate = opts.sampleRate;

  useEffect(() => {
    if (!timeline) return;
    const e = new Engine(timeline, { sampleRate: rate });
    // o motor é um recurso externo (AudioContext): nasce e morre com este efeito
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEngine(e);
    return () => {
      e.dispose();
      setEngine(null);
    };
  }, [timeline, rate]);

  return engine;
}

/** passa as fontes (memorizadas) ao motor a cada mudança; o áudio só é baixado no primeiro play */
export function useTracks(engine: Engine | null, tracks: Track[]): void {
  useEffect(() => {
    engine?.setTracks(tracks);
  }, [engine, tracks]);
}
