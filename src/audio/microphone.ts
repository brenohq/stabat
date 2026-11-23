/**
 * Microfone do Afinador. Liga com eco, ruído e ganho automático desligados (eles mexem no som e
 * atrapalham a altura) e entrega o último trecho (~85 ms) para a detecção. O som não sai do aparelho.
 */
import { audio } from "./sfx";

export type MicError = "denied" | "unsupported" | "no-device" | "failed";

interface AudioSession {
  type: string;
}
const session = () => (navigator as Navigator & { audioSession?: AudioSession }).audioSession;

/** trecho analisado a cada leitura */
export const MIC_WINDOW = 4096;

export class Microphone {
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private buf = new Float32Array(MIC_WINDOW);
  sampleRate = 48000;

  get on(): boolean {
    return !!this.stream;
  }

  /** chame dentro do toque (o iPhone só libera o áudio assim); rejeita com um MicError */
  async start(): Promise<void> {
    if (this.stream) return;
    const ctx = audio(); // nasce/acorda dentro do toque
    if (!ctx || !navigator.mediaDevices?.getUserMedia) throw "unsupported" satisfies MicError;
    // iPhone (Safari 16.4+): gravar e tocar ao mesmo tempo (o "playback" dos jogos desliga o microfone)
    try {
      const s = session();
      if (s) s.type = "play-and-record";
    } catch {
      /* segue */
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (e) {
      const name = (e as DOMException)?.name;
      throw (
        name === "NotAllowedError" || name === "SecurityError"
          ? "denied"
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "no-device"
            : "failed"
      ) satisfies MicError;
    }
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    this.stream = stream;
    this.sampleRate = ctx.sampleRate;
    this.source = ctx.createMediaStreamSource(stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = MIC_WINDOW;
    this.source.connect(this.analyser); // não vai para a saída: nada de microfonia
  }

  /** o último trecho do microfone (reaproveita o mesmo buffer) */
  read(): Float32Array | null {
    if (!this.analyser) return null;
    this.analyser.getFloatTimeDomainData(this.buf);
    return this.buf;
  }

  stop(): void {
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.source = null;
    this.analyser = null;
    try {
      const s = session();
      if (s && s.type === "play-and-record") s.type = "playback";
    } catch {
      /* segue */
    }
  }
}
