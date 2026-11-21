import { useEffect, useMemo, useState } from "react";
import type { WrittenNote } from "../lib/studies/notes";
import { upAndDown } from "../lib/studies/scales";
import { usePiano } from "./usePiano";
import { useScalePlayer } from "./useScalePlayer";

/**
 * O estado de uma lição: a nota da vez, o piano, o tocador (sobe e desce), metrônomo e andamento.
 * Escolher uma nota à mão (clique ou setas) toca ela no piano até escolher outra.
 */
export function useStudySession(notes: WrittenNote[]) {
  const [index, setIndex] = useState(0);
  const [metronome, setMetronome] = useState(true);
  const [bpm, setBpm] = useState(60);
  const midis = useMemo(() => notes.map((n) => n.midi), [notes]);
  const order = useMemo(() => upAndDown(midis.map((_, i) => i)), [midis]);
  const piano = usePiano();
  const player = useScalePlayer({ midis, order, bpm, metronome, piano, onIndex: setIndex });
  const current = Math.min(index, notes.length - 1);

  const select = (i: number, sound = true) => {
    player.stop();
    const next = (i + notes.length) % notes.length;
    setIndex(next);
    // a nota fica soando até escolher outra (piano, na altura escrita: igual em todo instrumento)
    if (sound) piano.play(notes[next]!.midi);
  };
  const reset = () => {
    player.stop();
    setIndex(0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("select, input, textarea, [role=listbox]")) return;
      if (e.key === "ArrowRight") select(current + 1);
      else if (e.key === "ArrowLeft") select(current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return { index: current, select, reset, piano, player, metronome, setMetronome, bpm, setBpm };
}

export type StudySession = ReturnType<typeof useStudySession>;
