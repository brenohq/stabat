import { lowerBound, type Timeline } from "../lib/timeline";
import { measureLoudness, type Loudness } from "../lib/loudness";
import { ignoreSilentSwitch, releaseSilentSwitch } from "./silentSwitch";

/** Processador do SoundTouch (MPL-2.0), servido de public/vendor. */
const SOUNDTOUCH_URL = `${import.meta.env.BASE_URL}vendor/soundtouch-processor.js`;

/** uma fonte de áudio pedida: o arquivo e o volume */
export interface Track {
  url: string;
  gain: number;
}

/** fonte pronta para tocar */
interface Stem {
  url: string;
  buffer: AudioBuffer;
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
  /** fontes tocando agora */
  private stems: Stem[] = [];
  /** fontes pedidas (podem ainda estar baixando) */
  private want: Track[] = [];
  /** áudio baixado e decodificado (ou a caminho), por URL */
  private buffers = new Map<string, Promise<AudioBuffer>>();
  /** muda a cada pedido novo: um carregamento ultrapassado não troca as fontes */
  private gen = 0;
  /** o músico já pediu para ouvir: a partir daí, trocar as fontes baixa o que faltar */
  private requested = false;
  private pendingCountIn = false;
  private fetchSlots = 4;
  private fetchQueue: (() => void)[] = [];
  private segments: Segment[] = [];
  private voices = new Set<OscillatorNode>();
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private raf = 0;
  private disposed = false;

  pos = 0;
  rate = 1;
  playing = false;
  /** as fontes pedidas estão prontas para tocar */
  loaded = false;
  /** baixando fontes (a primeira vez ou uma troca de mistura) */
  loading = false;
  /** 0–1 do carregamento em curso */
  progress = 0;
  /** apertou play antes do áudio chegar: toca assim que carregar */
  waiting = false;
  error: string | null = null;
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

  /**
   * Fontes a tocar (arquivo e volume; a ordem vale para loudness()). Nada é baixado antes
   * do primeiro play. Depois dele, uma troca para outros arquivos baixa só o que falta e
   * continua tocando a mistura anterior até tudo chegar; aí emenda sem parar.
   */
  setTracks(tracks: Track[]): void {
    this.want = tracks;
    if (this.loaded && sameUrls(tracks, this.stems)) {
      if (this.loading) {
        this.gen++; // voltou à mistura que já toca: esquece o que estava baixando
        this.loading = false;
      }
      tracks.forEach((t, i) => this.stems[i]!.gain.gain.setTargetAtTime(t.gain, this.ctx.currentTime, 0.02));
      this.emit();
      return;
    }
    if (this.requested) void this.prepare();
    else this.emit();
  }

  /** fontes pedidas, com o arquivo sem a pasta (para testes e depuração) */
  tracks(): { file: string; gain: number }[] {
    return this.want.map((t) => ({
      file: t.url.replace(/\?.*$/, "").replace(/^.*\//, ""),
      gain: Math.round(t.gain * 1000) / 1000,
    }));
  }

  /** baixa e decodifica as fontes pedidas e passa a tocar com elas */
  private async prepare(): Promise<void> {
    const gen = ++this.gen;
    const want = this.want;
    const urls = [...new Set(want.map((t) => t.url))];
    const frac = new Map(urls.map((u) => [u, 0]));
    const report = () => {
      if (gen !== this.gen) return;
      let sum = 0;
      for (const f of frac.values()) sum += f;
      this.progress = urls.length ? sum / urls.length : 1;
      this.emit();
    };
    this.loading = true;
    this.error = null;
    report();
    let bufs: Map<string, AudioBuffer>;
    try {
      const list = await Promise.all(
        urls.map((u) =>
          this.buffer(u, (f) => (frac.set(u, f), report())).then((b) => (frac.set(u, 1), report(), b)),
        ),
      );
      bufs = new Map(urls.map((u, i) => [u, list[i]!]));
    } catch (err) {
      for (const u of urls) this.buffers.delete(u); // deixa tentar de novo
      if (gen !== this.gen || this.disposed) return;
      console.error(err);
      this.loading = false;
      this.waiting = false;
      this.error = "Erro ao carregar o áudio";
      this.emit();
      return;
    }
    if (gen !== this.gen || this.disposed) return;
    this.swap(want, bufs);
    // solta da memória o que não toca mais (se voltar, vem do cache do navegador)
    for (const u of [...this.buffers.keys()]) if (!bufs.has(u)) this.buffers.delete(u);
    this.loading = false;
    this.loaded = true;
    this.progress = 1;
    if (this.waiting) {
      this.waiting = false;
      void this.play({ countIn: this.pendingCountIn });
    }
    this.emit();
  }

  /** áudio decodificado de uma URL (baixa uma vez; até 4 arquivos ao mesmo tempo) */
  private buffer(url: string, onProgress: (fraction: number) => void): Promise<AudioBuffer> {
    let p = this.buffers.get(url);
    if (!p) {
      p = this.withSlot(async () => {
        const data = await download(url, onProgress);
        return this.ctx.decodeAudioData(data);
      });
      this.buffers.set(url, p);
    }
    return p;
  }

  private async withSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (this.fetchSlots === 0) await new Promise<void>((r) => this.fetchQueue.push(r));
    else this.fetchSlots--;
    try {
      return await fn();
    } finally {
      const next = this.fetchQueue.shift();
      if (next) next();
      else this.fetchSlots++;
    }
  }

  /** troca as fontes; tocando, emenda com um cruzamento curto, sem mexer na posição */
  private swap(want: Track[], bufs: Map<string, AudioBuffer>): void {
    const old = this.stems;
    const live = this.playing && this.segments.length > 0;
    const t0 = this.ctx.currentTime + 0.05;
    const fade = 0.02;
    this.stems = want.map((t) => {
      const gain = this.ctx.createGain();
      if (live) {
        gain.gain.setValueAtTime(0, 0);
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(t.gain, t0 + fade);
      } else gain.gain.value = t.gain;
      gain.connect(this.bus);
      return { url: t.url, buffer: bufs.get(t.url)!, gain };
    });
    if (!live) {
      for (const s of old) s.gain.disconnect();
      return;
    }
    for (const s of old) {
      s.gain.gain.cancelScheduledValues(t0);
      s.gain.gain.setValueAtTime(s.gain.gain.value, t0);
      s.gain.gain.linearRampToValueAtTime(0, t0 + fade);
    }
    for (const seg of this.segments) {
      for (const x of seg.srcs) {
        try {
          x.stop(t0 + fade);
        } catch {
          /* já parado */
        }
      }
      if (seg.end <= t0) continue;
      const when = Math.max(t0, seg.when);
      const from = seg.from + (when - seg.when) * 1000 * this.rate;
      for (const s of this.stems) seg.srcs.push(this.source(s, when, from, seg.to));
    }
    setTimeout(() => old.forEach((s) => s.gain.disconnect()), 500);
  }

  /** volume percebido de uma fonte já carregada, na ordem de setTracks (null se ainda não carregou) */
  loudness(i: number): Loudness | null {
    const b = this.stems[i]?.buffer;
    if (!b) return null;
    const chans = Array.from({ length: b.numberOfChannels }, (_, c) => b.getChannelData(c));
    return measureLoudness(chans, b.sampleRate);
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
    if (this.playing || this.disposed) return;
    if (!this.loaded) {
      // primeiro play: só agora baixa o áudio, e toca quando chegar
      ignoreSilentSwitch(); // dentro do gesto do usuário
      void this.ctx.resume().catch(() => {});
      this.waiting = true;
      this.pendingCountIn = countIn;
      if (!this.requested || !this.loading) {
        this.requested = true;
        void this.prepare();
      }
      this.emit();
      return;
    }
    this.playing = true; // marca já: evita dois plays seguidos
    ignoreSilentSwitch(); // iPhone: tocar mesmo com a chave de silencioso (antes de qualquer await)
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
    for (const s of this.stems) seg.srcs.push(this.source(s, when, from, to));
    this.segments.push(seg);
    if (this.segments.length > 3) this.segments.shift();
  }

  /** agenda um trecho (ms do áudio) de uma fonte para começar em `when` */
  private source(s: Stem, when: number, from: number, to: number): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = s.buffer;
    src.playbackRate.value = this.rate;
    src.connect(s.gain);
    src.start(when, from / 1000, Math.max(0, (to - from) / 1000));
    return src;
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
    releaseSilentSwitch();
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
    if (this.waiting) {
      this.waiting = false; // desistiu antes do áudio chegar (o download segue)
      releaseSilentSwitch();
      this.emit();
    }
    if (!this.playing) return;
    this.pos = this.now();
    this.halt();
    this.emit();
  }

  toggle(): void {
    if (this.playing || this.waiting) this.pause();
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
    this.gen++;
    this.halt();
    this.buffers.clear();
    this.listeners.clear();
    void this.ctx.close();
  }
}

function sameUrls(tracks: Track[], stems: Stem[]): boolean {
  return tracks.length === stems.length && tracks.every((t, i) => t.url === stems[i]!.url);
}

/** baixa um arquivo inteiro, contando o progresso pelos bytes recebidos */
async function download(url: string, onProgress: (fraction: number) => void): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Falha ao baixar ${url}`);
  const total = Number(r.headers.get("content-length")) || 0;
  if (!r.body || !total) return r.arrayBuffer();
  const reader = r.body.getReader();
  const out = new Uint8Array(total);
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (got + value.length > total) return concatTail(out.subarray(0, got), value, reader);
    out.set(value, got);
    got += value.length;
    onProgress(got / total);
  }
  return got === total ? out.buffer : out.slice(0, got).buffer;
}

/** o servidor mandou mais que o content-length (ex.: compressão): junta o resto sem contar */
async function concatTail(
  head: Uint8Array,
  value: Uint8Array,
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<ArrayBuffer> {
  const chunks = [head, value];
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    chunks.push(r.value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out.buffer;
}
