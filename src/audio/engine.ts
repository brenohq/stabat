import { lowerBound, type Timeline } from "../lib/timeline";

/** Processador do SoundTouch (MPL-2.0), servido de public/vendor. */
const SOUNDTOUCH_URL = `${import.meta.env.BASE_URL}vendor/soundtouch-processor.js`;

interface Stem {
  buffer: AudioBuffer | null;
  gain: GainNode;
}

interface Segment {
  /** hora do AudioContext em que começa */
  when: number;
  /** posição (ms do áudio) no início e no fim */
  from: number;
  to: number;
  /** hora do AudioContext em que termina */
  end: number;
  srcs: AudioBufferSourceNode[];
  beatIdx: number;
  chained?: boolean;
}

export interface EngineOptions {
  /** taxa de amostragem do AudioContext; menor = menos memória com muitas partes */
  sampleRate?: number;
}

type Listener = () => void;

/**
 * Toca várias partes em sincronia (um AudioBuffer por parte, um volume por parte),
 * com metrônomo, contagem, trecho em loop e velocidade sem mudar a afinação.
 * Tempos em ms do áudio (já com ritornelos, como na Timeline).
 */
export class Engine {
  readonly ctx: AudioContext;
  readonly analyser: AnalyserNode;
  private readonly limiter: DynamicsCompressorNode;
  private readonly bus: GainNode;
  private readonly clickGain: GainNode;
  private stNode: AudioWorkletNode | null | undefined;
  private stems: Stem[] = [];
  private segments: Segment[] = [];
  private voices = new Set<OscillatorNode>();
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private raf = 0;
  private disposed = false;

  pos = 0;
  rate = 1;
  playing = false;
  loaded = false;
  metronome = true;
  countIn = false;
  loop: [number, number] | null = null;

  constructor(
    readonly timeline: Timeline,
    { sampleRate }: EngineOptions = {},
  ) {
    let ctx: AudioContext;
    try {
      ctx = new AudioContext(
        sampleRate ? { sampleRate, latencyHint: "playback" } : { latencyHint: "playback" },
      );
    } catch {
      ctx = new AudioContext();
    }
    this.ctx = ctx;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.knee.value = 3;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.2;
    this.limiter.connect(ctx.destination);
    // medidor no volume geral: usado pelos testes para saber se há som
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.limiter.connect(this.analyser);
    this.bus = ctx.createGain();
    this.bus.connect(this.limiter);
    this.clickGain = ctx.createGain();
    this.clickGain.gain.value = 0.5;
    this.clickGain.connect(this.bus);
  }

  /** inscreve um ouvinte (chamado a cada quadro tocando e a cada mudança); devolve o cancelamento */
  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit(): void {
    for (const f of this.listeners) f();
  }

  get partCount(): number {
    return this.stems.length;
  }

  /** baixa e decodifica as partes; o índice de cada URL é o índice usado em setGain */
  async load(urls: string[], onProgress?: (fraction: number) => void): Promise<void> {
    let done = 0;
    this.stems = urls.map(() => {
      const gain = this.ctx.createGain();
      gain.connect(this.bus);
      return { buffer: null, gain };
    });
    const queue = urls.map((u, i) => [u, i] as const);
    const worker = async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        const [url, i] = item;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`Falha ao baixar ${url}`);
        const data = await r.arrayBuffer();
        if (this.disposed) return;
        this.stems[i]!.buffer = await this.ctx.decodeAudioData(data);
        onProgress?.(++done / urls.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, urls.length) }, worker));
    if (this.disposed) return;
    this.loaded = true;
    this.emit();
  }

  setGain(i: number, v: number): void {
    this.stems[i]?.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  /** volume atual de cada parte (para testes e depuração) */
  gains(): number[] {
    return this.stems.map((s) => Math.round(s.gain.gain.value * 1000) / 1000);
  }

  /** nível RMS do que está saindo agora (0 = silêncio) */
  level(): number {
    const a = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(a);
    let s = 0;
    for (const x of a) s += x * x;
    return Math.sqrt(s / a.length);
  }

  private async ensureStretch(): Promise<AudioWorkletNode | null> {
    if (this.stNode !== undefined) return this.stNode;
    try {
      await this.ctx.audioWorklet.addModule(SOUNDTOUCH_URL);
      this.stNode = new AudioWorkletNode(this.ctx, "soundtouch-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: { sampleBufferType: "circular" },
      });
    } catch (e) {
      console.warn("SoundTouch indisponível; velocidade vai mudar a afinação", e);
      this.stNode = null;
    }
    return this.stNode;
  }

  /** com velocidade ≠ 100% o som passa pelo SoundTouch, que desfaz a mudança de afinação */
  private route(stretch: boolean): void {
    this.bus.disconnect();
    if (stretch && this.stNode) {
      this.bus.connect(this.stNode);
      this.stNode.connect(this.limiter);
      this.stNode.parameters.get("playbackRate")!.value = this.rate;
      this.stNode.parameters.get("pitch")!.value = 1;
    } else this.bus.connect(this.limiter);
  }

  /** posição atual em ms do áudio */
  now(): number {
    if (!this.playing || !this.segments.length) return this.pos;
    const ct = this.ctx.currentTime;
    let s = this.segments[0]!;
    for (const x of this.segments) if (x.when <= ct) s = x;
    return Math.min(s.from + Math.max(0, ct - s.when) * 1000 * this.rate, s.to);
  }

  async play({ countIn = this.countIn }: { countIn?: boolean } = {}): Promise<void> {
    if (this.playing || !this.loaded || this.disposed) return;
    this.playing = true; // marca já: evita dois plays seguidos
    if (this.ctx.state !== "running") await this.ctx.resume();
    if (this.rate !== 1) await this.ensureStretch();
    if (!this.playing) return; // pausado enquanto preparava
    this.route(this.rate !== 1);
    const dur = this.timeline.duration;
    if (this.loop && (this.pos < this.loop[0] || this.pos >= this.loop[1])) this.pos = this.loop[0];
    if (this.pos >= dur - 30) this.pos = this.loop ? this.loop[0] : 0;
    let when = this.ctx.currentTime + 0.06;
    if (countIn) {
      const { beatMs, beats } = this.timeline.beatAt(this.pos);
      const b = beatMs / 1000 / this.rate;
      for (let i = 0; i < beats; i++) this.click(when + i * b, i === 0);
      when += beats * b;
    }
    this.segments = [];
    this.startSegment(when, this.pos);
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
    const frame = () => {
      if (!this.playing) return;
      this.emit();
      this.raf = requestAnimationFrame(frame);
    };
    frame();
  }

  private startSegment(when: number, from: number): void {
    const to = this.loop ? this.loop[1] : this.timeline.duration;
    const seg: Segment = {
      when,
      from,
      to,
      end: when + (to - from) / 1000 / this.rate,
      srcs: [],
      beatIdx: lowerBound(this.timeline.beats, from - 1, (b) => b.t),
    };
    for (const s of this.stems) {
      if (!s.buffer) continue;
      const src = this.ctx.createBufferSource();
      src.buffer = s.buffer;
      src.playbackRate.value = this.rate;
      src.connect(s.gain);
      src.start(when, from / 1000, Math.max(0, (to - from) / 1000));
      seg.srcs.push(src);
    }
    this.segments.push(seg);
    if (this.segments.length > 3) this.segments.shift();
  }

  private tick(): void {
    const ct = this.ctx.currentTime;
    const last = this.segments.at(-1);
    if (!last) return;
    // metrônomo: agenda os tempos dos próximos ~200 ms
    if (this.metronome)
      for (const seg of this.segments) {
        const beats = this.timeline.beats;
        while (seg.beatIdx < beats.length) {
          const b = beats[seg.beatIdx]!;
          if (b.t >= seg.to - 1) {
            seg.beatIdx = beats.length;
            break;
          }
          const w = seg.when + (b.t - seg.from) / 1000 / this.rate;
          if (w > ct + 0.2) break;
          if (w >= ct - 0.005) this.click(w, b.accent);
          seg.beatIdx++;
        }
      }
    if (this.loop && last.end - ct < 0.25 && !last.chained) {
      last.chained = true;
      this.startSegment(last.end, this.loop[0]);
    }
    if (!this.loop && ct >= last.end) {
      this.halt();
      this.pos = 0;
      this.emit();
    }
  }

  private click(when: number, accent: boolean): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.value = accent ? 1600 : 1100;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(accent ? 0.9 : 0.6, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
    o.connect(g);
    g.connect(this.clickGain);
    o.start(when);
    o.stop(when + 0.08);
    this.voices.add(o);
    o.onended = () => this.voices.delete(o);
  }

  /** para tudo sem emitir */
  private halt(): void {
    this.playing = false;
    clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    for (const s of this.segments)
      for (const x of s.srcs) {
        try {
          x.stop();
        } catch {
          /* já parado */
        }
      }
    for (const o of this.voices) {
      try {
        o.stop();
      } catch {
        /* já parado */
      }
    }
    this.voices.clear();
    this.segments = [];
  }

  pause(): void {
    if (!this.playing) return;
    this.pos = this.now();
    this.halt();
    this.emit();
  }

  toggle(): void {
    if (this.playing) this.pause();
    else void this.play();
  }

  /** volta ao início (ou ao início do trecho em loop) */
  stop(): void {
    this.pause();
    this.pos = this.loop ? this.loop[0] : 0;
    this.emit();
  }

  seek(ms: number, { autoplay = false, countIn = false } = {}): void {
    const was = this.playing;
    if (was) {
      this.pos = this.now();
      this.halt();
    }
    this.pos = Math.max(0, Math.min(ms, this.timeline.duration));
    if (was) void this.play({ countIn: false });
    else if (autoplay) void this.play({ countIn });
    else this.emit();
  }

  /** clique num compasso: toca a partir da ocorrência mais próxima da posição atual */
  seekMeasure(m: number): void {
    const k = this.timeline.occurrence(m, this.now());
    if (k === null) return;
    const t = this.timeline.startOf(k);
    if (this.loop && (t < this.loop[0] || t >= this.loop[1])) this.setLoop(null);
    this.seek(t, { autoplay: true, countIn: this.countIn });
  }

  async setRate(r: number): Promise<void> {
    const was = this.playing;
    if (was) this.pause();
    this.rate = r;
    if (r !== 1) await this.ensureStretch();
    if (was) await this.play({ countIn: false });
    else this.emit();
  }

  setMetronome(on: boolean): void {
    this.metronome = on;
    this.emit();
  }

  setCountIn(on: boolean): void {
    this.countIn = on;
    this.emit();
  }

  setLoop(range: [number, number] | null): void {
    const was = this.playing;
    if (was) this.pause();
    this.loop = range;
    if (range) this.pos = range[0];
    if (was) void this.play({ countIn: false });
    else this.emit();
  }

  dispose(): void {
    this.disposed = true;
    this.halt();
    this.listeners.clear();
    void this.ctx.close();
  }
}
