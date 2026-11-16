import { useEffect, useState } from "react";
import { Engine, type EngineOptions } from "../audio/engine";
import type { Timeline } from "../lib/timeline";

interface PlayerState {
  engine: Engine | null;
  progress: number;
  error: string | null;
}

/** cria o motor de áudio, baixa as partes e libera tudo ao sair da página */
export function usePlayer(timeline: Timeline | null, urls: string[], opts: EngineOptions = {}): PlayerState {
  const [state, setState] = useState<PlayerState>({ engine: null, progress: 0, error: null });
  const key = urls.join("|");
  const rate = opts.sampleRate;

  useEffect(() => {
    if (!timeline || !key) return;
    const engine = new Engine(timeline, { sampleRate: rate });
    // o motor é um recurso externo (AudioContext): nasce e morre com este efeito
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ engine, progress: 0, error: null });
    engine
      .load(key.split("|"), (progress) => setState((s) => (s.engine === engine ? { ...s, progress } : s)))
      .catch((err: unknown) => {
        console.error(err);
        setState((s) => (s.engine === engine ? { ...s, error: "Erro ao carregar o áudio" } : s));
      });
    return () => {
      engine.dispose();
      setState({ engine: null, progress: 0, error: null });
    };
  }, [timeline, key, rate]);

  return state;
}
