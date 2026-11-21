import { useCallback, useEffect, useRef, useState } from "react";
import { loadPiano } from "../audio/piano";
import { audio, click } from "../audio/sfx";
import type { Piano } from "./usePiano";

const COUNT_IN = 4;

/**
 * Toca as notas na ordem dada (a escala sobe e desce), uma por tempo, no piano e na altura escrita (o mesmo som
 * em todos os instrumentos). Cada nota soa o tempo inteiro e é abafada quando entra a próxima.
 * Com o metrônomo ligado, conta um compasso antes e marca os tempos.
 * `index` acompanha a nota que soa; parado, fica onde o músico deixou.
 */
export function useScalePlayer({
  midis,
  order,
  bpm,
  metronome,
  piano,
  onIndex,
}: {
  midis: number[];
  /** a ordem em que as notas tocam (índices de `midis`) */
  order: number[];
  bpm: number;
  metronome: boolean;
  piano: Piano;
  onIndex: (i: number) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);
  const run = useRef(0);

  const stop = useCallback(() => {
    run.current++;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    piano.release();
    setPlaying(false);
  }, [piano]);

  const start = useCallback(async () => {
    stop();
    audio(); // liga o som ainda dentro do toque (o iPhone exige), antes de esperar as amostras
    const mine = run.current;
    setPlaying(true);
    // a primeira nota não sai muda: espera as amostras (já costumam estar prontas)
    await loadPiano().catch(() => {});
    if (run.current !== mine) return;
    const beat = 60_000 / bpm;
    const lead = metronome ? COUNT_IN : 0;
    const t0 = performance.now();
    let n = 0;
    const tick = () => {
      const i = n - lead;
      if (i >= order.length) return stop(); // a última nota soou o tempo inteiro
      if (metronome) click(n % 4 === 0);
      if (i >= 0) {
        const idx = order[i]!;
        onIndex(idx);
        piano.play(midis[idx]!);
      }
      n++;
      timer.current = window.setTimeout(tick, Math.max(0, t0 + n * beat - performance.now()));
    };
    tick();
  }, [midis, order, bpm, metronome, piano, onIndex, stop]);

  // trocar a escala ou o andamento para o que estiver tocando
  useEffect(() => stop, [midis, bpm, metronome, stop]);

  return { playing, start, stop };
}
