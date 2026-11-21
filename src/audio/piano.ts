/**
 * Piano dos estudos: amostras gravadas (Salamander Grand Piano, CC-BY 3.0; ver
 * public/audio/piano/LICENSE.txt), uma a cada terça menor de Ré♯3 a Fá♯6 (a extensão escrita dos estudos). As notas do meio são a
 * amostra mais próxima com a velocidade ajustada (no máximo 1,5 semitom). Cada nota soa enquanto
 * estiver ativa e é abafada (como ao soltar a tecla) quando a próxima começa ou o músico para.
 */
import { audio } from "./sfx";

const SAMPLES: [name: string, midi: number][] = [
  ["Ds3", 51],
  ["Fs3", 54],
  ["A3", 57],
  ["C4", 60],
  ["Ds4", 63],
  ["Fs4", 66],
  ["A4", 69],
  ["C5", 72],
  ["Ds5", 75],
  ["Fs5", 78],
  ["A5", 81],
  ["C6", 84],
  ["Ds6", 87],
  ["Fs6", 90],
];

/** a amostra mais próxima da nota e o quanto acelerar/frear para chegar nela */
export function sampleFor(midi: number): { name: string; rate: number } {
  let best = SAMPLES[0]!;
  for (const s of SAMPLES) if (Math.abs(s[1] - midi) < Math.abs(best[1] - midi)) best = s;
  return { name: best[0], rate: 2 ** ((midi - best[1]) / 12) };
}

let loading: Promise<Map<string, AudioBuffer>> | null = null;

/** baixa e decodifica as amostras uma vez (sem precisar de toque: decodifica fora do som) */
export function loadPiano(): Promise<Map<string, AudioBuffer>> {
  loading ??= (async () => {
    const decoder = new OfflineAudioContext(2, 1, 44100);
    const entries = await Promise.all(
      SAMPLES.map(async ([name]) => {
        const res = await fetch(`/audio/piano/${name}.mp3`);
        if (!res.ok) throw new Error(`piano: ${name} ${res.status}`);
        return [name, await decoder.decodeAudioData(await res.arrayBuffer())] as const;
      }),
    );
    return new Map(entries);
  })().catch((e: unknown) => {
    loading = null; // tenta de novo na próxima vez
    throw e;
  });
  return loading;
}

export interface Voice {
  /** abafa a nota (soltar a tecla) */
  release(): void;
}

const RELEASE = 0.12;

/** toca a nota (altura escrita, em MIDI) e devolve como abafá-la */
export function pianoNote(midi: number, buffers: Map<string, AudioBuffer>, gain = 0.8): Voice | null {
  const a = audio();
  const { name, rate } = sampleFor(midi);
  const buffer = buffers.get(name);
  if (!a || !buffer) return null;
  const t = a.currentTime;
  const out = a.createGain();
  out.gain.setValueAtTime(gain, t);
  out.connect(a.destination);
  const src = a.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  src.connect(out);
  src.start(t);
  let done = false;
  return {
    release() {
      if (done) return;
      done = true;
      const now = a.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.exponentialRampToValueAtTime(0.0001, now + RELEASE);
      src.stop(now + RELEASE + 0.02);
    },
  };
}
