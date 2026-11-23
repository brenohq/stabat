import { useCallback, useEffect, useRef, useState } from "react";
import { Microphone, type MicError } from "../audio/microphone";
import { detectPitch, rms } from "../lib/tuner/pitch";
import { Median } from "../lib/tuner/tuning";

export type MicStatus = "off" | "starting" | "on" | MicError;

export interface MicPitch {
  /** Hz (mediana das últimas leituras); null = silêncio ou ruído */
  freq: number | null;
  /** volume do microfone, 0–1 */
  level: number;
  /** hora (performance.now) da leitura */
  at: number;
}

/** ~20 leituras por segundo: a agulha anda liso e o celular não esquenta */
const EVERY_MS = 50;
/** sem nota por este tempo = silêncio */
const SILENCE_MS = 350;

/** o microfone e a altura do que ele ouve; o microfone desliga ao sair da página.
 *  `onPitch` é chamada a cada leitura (fora da renderização). */
export function useMicPitch(onPitch?: (p: MicPitch) => void) {
  const mic = useRef<Microphone | null>(null);
  const listener = useRef(onPitch);
  useEffect(() => {
    listener.current = onPitch;
  });
  const [status, setStatus] = useState<MicStatus>("off");
  const [pitch, setPitch] = useState<MicPitch>({ freq: null, level: 0, at: 0 });

  const start = useCallback(async () => {
    mic.current ??= new Microphone();
    setStatus("starting");
    try {
      await mic.current.start();
      setStatus("on");
    } catch (e) {
      setStatus(typeof e === "string" ? (e as MicError) : "failed");
    }
  }, []);

  const stop = useCallback(() => {
    mic.current?.stop();
    setStatus("off");
    setPitch({ freq: null, level: 0, at: performance.now() });
  }, []);

  useEffect(() => () => mic.current?.stop(), []);

  useEffect(() => {
    if (status !== "on") return;
    const m = mic.current!;
    const median = new Median(5);
    let lastNote = 0;
    let lastRead = 0;
    let raf = 0;
    let freq: number | null = null;
    const emit = (p: MicPitch) => {
      setPitch(p);
      listener.current?.(p);
      return p;
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - lastRead < EVERY_MS) return;
      lastRead = now;
      const buf = m.read();
      if (!buf) return;
      const level = Math.min(1, rms(buf) * 6);
      const p = detectPitch(buf, m.sampleRate);
      if (p) {
        // mediana em cents absolutos: um harmônico isolado (oitava acima) não mexe na agulha
        const c = median.push(1200 * Math.log2(p.freq / 440));
        lastNote = now;
        freq = 440 * 2 ** (c / 1200);
        emit({ freq, level, at: now });
      } else if (now - lastNote > SILENCE_MS) {
        median.clear();
        freq = null;
        emit({ freq, level, at: now });
      } else emit({ freq, level, at: now }); // um buraco curto: segura a última nota
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  return { status, pitch, start, stop };
}

/** tela acesa enquanto `active` (o maestro não fica tocando no celular para ele não apagar) */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let gone = false;
    const take = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (gone) void l.release();
          else lock = l;
        })
        .catch(() => {});
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", take);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}
