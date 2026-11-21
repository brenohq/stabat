import { useCallback, useEffect, useMemo, useRef } from "react";
import { loadPiano, pianoNote, type Voice } from "../audio/piano";
import { stopSfx } from "../audio/sfx";

/**
 * Uma nota de piano por vez: tocar a próxima abafa a anterior; a nota fica soando enquanto
 * estiver ativa (até `release` ou a próxima). As amostras começam a baixar quando a página abre.
 */
export function usePiano() {
  const voice = useRef<Voice | null>(null);
  const buffers = useRef<Map<string, AudioBuffer> | null>(null);
  // cada play/release invalida o anterior (uma nota que ainda esperava as amostras não toca atrasada)
  const turn = useRef(0);
  // a nota que está soando (MIDI), para os testes saberem
  const sounding = useRef<number | null>(null);

  useEffect(() => {
    loadPiano()
      .then((b) => (buffers.current = b))
      .catch(() => {});
    return () => {
      voice.current?.release();
      stopSfx();
    };
  }, []);

  const release = useCallback(() => {
    turn.current++;
    voice.current?.release();
    voice.current = null;
    sounding.current = null;
  }, []);

  const play = useCallback(
    (midi: number) => {
      release();
      const mine = turn.current;
      const go = (b: Map<string, AudioBuffer>) => {
        if (turn.current !== mine) return;
        voice.current = pianoNote(midi, b);
        if (voice.current) sounding.current = midi;
      };
      if (buffers.current) go(buffers.current);
      else
        loadPiano()
          .then((b) => {
            buffers.current = b;
            go(b);
          })
          .catch(() => {});
    },
    [release],
  );

  return useMemo(() => ({ play, release, sounding: () => sounding.current }), [play, release]);
}

export type Piano = ReturnType<typeof usePiano>;
