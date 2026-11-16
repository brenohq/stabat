/* stabat — código compartilhado.
 * Partitura: Verovio (MusicXML → SVG). Tempos dos compassos (com ritornelos): .mpos do MuseScore.
 * Áudio: um MP3 por parte renderizado com Muse Sounds, mixado no navegador com Web Audio.
 * Velocidade sem mudar a afinação: SoundTouch (AudioWorklet). */

const VEROVIO_URL = "https://cdn.jsdelivr.net/npm/verovio@6.3.0/dist/verovio-toolkit-wasm.js";
const SOUNDTOUCH_URL = "assets/vendor/soundtouch-processor.js";

const Icons = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  loop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
  rewind: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="2.4" height="14" rx="1"/><path d="M19 6.2v11.6a.8.8 0 0 1-1.25.66L9.4 12.66a.8.8 0 0 1 0-1.32l8.35-5.8A.8.8 0 0 1 19 6.2z"/></svg>',
  metro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l4 18H5z"/><path d="M12 15l5-9"/></svg>',
  person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  zoomIn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M10.5 7.8v5.4M7.8 10.5h5.4"/></svg>',
  zoomOut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M7.8 10.5h5.4"/></svg>',
  caret: '<svg class="car" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
};
const BRAND = '<a class="brand" href="./"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 3.5v11.1A3.5 3.5 0 1 0 12 17.7V8.2l7-1.7v6.1a3.5 3.5 0 1 0 2 3.1V2.6z"/></svg>stabat</a>';

/* ---------------------------------------------------------------- dados e utilidades */
const Stabat = {
  q: new URLSearchParams(location.search),
  async index() { return (await fetch("arranjos/index.json", { cache: "no-cache" })).json(); },
  async meta(id) {
    const r = await fetch(`arranjos/${encodeURIComponent(id)}/meta.json`, { cache: "no-cache" });
    if (!r.ok) throw new Error("Arranjo não encontrado");
    return r.json();
  },
  url(meta, path) { return `arranjos/${meta.id}/${path}?v=${meta.version}`; },
  fmt(sec) { sec = Math.max(0, Math.floor(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; },
  family(name) {
    const n = name.toLowerCase();
    if (/clarinete|flauta|sax (alto|tenor|soprano|bar)/.test(n)) return "wood";
    if (/trompete|saxhorn|trompa/.test(n)) return "brass-hi";
    return "brass-lo";
  },
  familyLabel: { "wood": "Madeiras", "brass-hi": "Metais agudos", "brass-lo": "Metais graves" },
  shortName(name) { return name.replace(/ (Sib|Mib|Fá|Dó)\b/, ""); },
  getMyPart() { try { return JSON.parse(localStorage.getItem("stabat.myPart") || "null"); } catch { return null; } },
  setMyPart(v) { try { localStorage.setItem("stabat.myPart", JSON.stringify(v)); } catch {} },
  load(key, def) { try { const v = localStorage.getItem("stabat." + key); return v == null ? def : JSON.parse(v); } catch { return def; } },
  save(key, v) { try { localStorage.setItem("stabat." + key, JSON.stringify(v)); } catch {} },
  sectionAt(meta, m) { let c = null; for (const mk of meta.marks) if (mk.m <= m) c = mk.label; return c; },
};

/* Qualquer link com data-mypart grava a parte escolhida ao ser clicado. */
document.addEventListener("click", e => {
  const a = e.target.closest("[data-mypart]");
  if (a) Stabat.setMyPart({ id: a.dataset.mypart, name: a.dataset.mypartName || a.dataset.mypart });
}, true);

/* Troca o ícone só quando o estado muda (recriar o SVG a cada quadro faz o clique se perder). */
function playIcon(btn, playing) {
  if (btn._playing === playing) return;
  btn._playing = playing;
  const ring = btn.querySelector(".ring");
  btn.innerHTML = playing ? Icons.pause : Icons.play;
  if (ring) btn.appendChild(ring);
  btn.setAttribute("aria-label", playing ? "Pausar" : "Tocar");
}
function loadingRing(btn, frac) {
  let r = btn.querySelector(".ring");
  if (frac >= 1) { if (r) r.remove(); btn.disabled = false; return; }
  btn.disabled = true;
  if (!r) { btn.insertAdjacentHTML("beforeend", '<svg class="ring" viewBox="0 0 56 56"><circle cx="28" cy="28" r="26"/></svg>'); r = btn.querySelector(".ring"); }
  const c = r.querySelector("circle"), L = 2 * Math.PI * 26;
  c.style.strokeDasharray = L; c.style.strokeDashoffset = L * (1 - frac);
}
document.querySelectorAll(".brand-slot").forEach(e => e.outerHTML = BRAND);
document.querySelectorAll("[data-icon]").forEach(e => e.innerHTML = Icons[e.dataset.icon] + (e.innerHTML || ""));

/* ---------------------------------------------------------------- linha do tempo (com ritornelos) */
class Timeline {
  constructor(meta) {
    this.ev = meta.timeline; // [{m, t, end, beats}] em ms, na ordem tocada
    this.duration = meta.duration * 1000;
    this.beats = [];
    for (const e of this.ev) {
      const step = (e.end - e.t) / e.beats;
      for (let b = 0; b < e.beats; b++) this.beats.push({ t: e.t + b * step, accent: b === 0 });
    }
  }
  indexAt(ms) {
    const ev = this.ev; let lo = 0, hi = ev.length - 1, r = 0;
    while (lo <= hi) { const k = (lo + hi) >> 1; if (ev[k].t <= ms) { r = k; lo = k + 1; } else hi = k - 1; }
    return r;
  }
  at(ms) { const k = this.indexAt(ms), e = this.ev[k]; return { k, m: e.m, frac: Math.max(0, Math.min(1, (ms - e.t) / ((e.end - e.t) || 1))) }; }
  /* ocorrência do compasso m mais próxima da posição atual */
  occurrence(m, nearMs = 0) {
    let best = null;
    for (let k = 0; k < this.ev.length; k++) if (this.ev[k].m === m && (best == null || Math.abs(this.ev[k].t - nearMs) < Math.abs(this.ev[best].t - nearMs))) best = k;
    return best;
  }
  first(m) { const k = this.ev.findIndex(e => e.m === m); return k < 0 ? null : k; }
  /* trecho a..b (compassos da partitura) → [início, fim] em ms */
  range(a, b, nearMs) {
    const ka = this.occurrence(a, nearMs); if (ka == null) return null;
    let kb = ka; for (let k = ka; k < this.ev.length; k++) { if (this.ev[k].m === b) { kb = k; break; } }
    return [this.ev[ka].t, this.ev[kb].end];
  }
  beatMsAt(ms) { const e = this.ev[this.indexAt(ms)]; return { beatMs: (e.end - e.t) / e.beats, beats: e.beats }; }
}

/* ---------------------------------------------------------------- partitura */
let _vrvPromise;
function loadVerovio() {
  if (_vrvPromise) return _vrvPromise;
  _vrvPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = VEROVIO_URL;
    s.onload = () => { const done = () => resolve(verovio); if (verovio.module.calledRun) done(); else verovio.module.onRuntimeInitialized = done; };
    s.onerror = () => reject(new Error("Não foi possível carregar o Verovio"));
    document.head.appendChild(s);
  });
  return _vrvPromise;
}

class ScoreView {
  /* scale: número ou função(largura) → escala; vrv: opções extras do Verovio; transform: (xml) → xml */
  constructor(el, { scale = 35, onMeasureClick, vrv, transform } = {}) {
    this.el = el; this.scaleOpt = scale; this.scale = typeof scale === "function" ? scale(el.clientWidth) : scale;
    this.onMeasureClick = onMeasureClick; this.vrv = vrv; this.transform = transform;
    this.measureEls = []; this.cur = -1; this.playing = []; this.muted = null; this.loop = null;
    el.classList.add("score");
    el.innerHTML = '<div class="loading">Carregando partitura…<div class="bar"></div></div>';
  }
  async load(url) {
    const vrv = await loadVerovio();
    this.tk = new vrv.toolkit();
    let xml = await (await fetch(url)).text();
    if (this.transform) xml = this.transform(xml);
    this.tk.setOptions(this.opts());
    this.tk.loadData(xml);
    this.render();
    const tm = this.tk.renderToTimemap({ includeMeasures: true });
    this.mTimes = tm.filter(e => e.measureOn).map(e => e.tstamp);
    const last = tm[tm.length - 1];
    this.mTimes.push(last ? last.tstamp : 0);
    this.events = tm.filter(e => e.on && e.on.length).map(e => ({ t: e.tstamp, on: e.on }));
    let ro; new ResizeObserver(() => { clearTimeout(ro); ro = setTimeout(() => this.relayout(), 200); }).observe(this.el);
    return this;
  }
  opts() {
    const w = Math.max(300, this.el.clientWidth - 8);
    if (typeof this.scaleOpt === "function") this.scale = this.scaleOpt(w);
    const extra = typeof this.vrv === "function" ? this.vrv(w) : (this.vrv || {});
    return { scale: this.scale, pageWidth: Math.round(w * 100 / this.scale), adjustPageHeight: true, breaks: "auto",
      footer: "none", header: "none", pageMarginTop: 40, pageMarginBottom: 40, pageMarginLeft: 30, pageMarginRight: 30,
      svgHtml5: true, svgViewBox: true, systemMaxPerPage: 24, justifyVertically: false, expandNever: true, ...extra };
  }
  relayout() {
    if (!this.tk) return;
    const o = this.opts();
    if (o.pageWidth === this._pw && this.scale === this._sc) return;
    this.tk.setOptions(o); this.tk.redoLayout(); this.render();
  }
  setScale(s) { this.scaleOpt = s; this.scale = s; this.relayout(); }
  render() {
    const o = this.opts(); this._pw = o.pageWidth; this._sc = this.scale;
    const n = this.tk.getPageCount(); let html = "";
    for (let i = 1; i <= n; i++) html += `<div class="page">${this.tk.renderToSVG(i)}</div>`;
    this.el.innerHTML = html;
    this.measureEls = [...this.el.querySelectorAll("g.measure")];
    this.measureEls.forEach((m, i) => m.addEventListener("click", ev => { ev.stopPropagation(); this.onMeasureClick && this.onMeasureClick(i, ev); }));
    const keep = this.cur; this.cur = -1; this._hl = null; this.playing = []; this._lastEv = null;
    if (keep >= 0) this.highlight(keep, false);
    this.applyMuted(); this.drawLoop();
  }
  rectFor(i, cls) {
    const m = this.measureEls[i]; if (!m) return null;
    const bb = m.getBBox();
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("class", cls);
    r.setAttribute("x", bb.x - 40); r.setAttribute("y", bb.y - 120);
    r.setAttribute("width", bb.width + 40); r.setAttribute("height", bb.height + 240); r.setAttribute("rx", 60);
    m.insertBefore(r, m.firstChild);
    return r;
  }
  highlight(i, scroll = true) {
    if (i === this.cur) return;
    this.cur = i;
    if (this._hl) this._hl.remove();
    this._hl = this.rectFor(i, "measure-hl");
    if (scroll && this._hl) this.scrollTo(i);
  }
  scrollTo(i) {
    const m = this.measureEls[i]; if (!m) return;
    const sys = m.closest("g.system") || m;
    const r = sys.getBoundingClientRect();
    const top = this.topOffset || 0, bottom = this.bottomOffset ?? (document.querySelector(".sbar")?.offsetHeight || 0);
    if (r.top < top + 10 || r.bottom > innerHeight - bottom - 10)
      scrollBy({ top: r.top - top - (innerHeight - top - bottom) * 0.18, behavior: "smooth" });
  }
  /* posição de execução: compasso m + fração → colore as notas soando */
  markPlaying(m, frac) {
    if (!this.events || !this.mTimes) return;
    const t0 = this.mTimes[m], t1 = this.mTimes[m + 1] ?? t0;
    const ms = t0 + frac * (t1 - t0) + 1;
    let lo = 0, hi = this.events.length - 1, k = -1;
    while (lo <= hi) { const x = (lo + hi) >> 1; if (this.events[x].t <= ms) { k = x; lo = x + 1; } else hi = x - 1; }
    if (k === this._lastEv) return; this._lastEv = k;
    for (const e of this.playing) e.classList.remove("playing");
    this.playing = [];
    if (k < 0) return;
    for (const id of this.events[k].on) { const e = document.getElementById(id); if (e) { e.classList.add("playing"); this.playing.push(e); } }
  }
  clearPlaying() { for (const e of this.playing) e.classList.remove("playing"); this.playing = []; this._lastEv = null; }
  setMuted(set) { this.muted = set; this.applyMuted(); }
  applyMuted() {
    if (!this.muted) return;
    for (const m of this.measureEls) m.querySelectorAll(":scope > g.staff").forEach((s, i) => s.classList.toggle("muted", this.muted.has(i)));
  }
  setLoop(a, b) { this.loop = a == null ? null : [a, b]; this.drawLoop(); }
  drawLoop() {
    (this._loopRects || []).forEach(r => r.remove()); this._loopRects = [];
    if (!this.loop) return;
    const [a, b] = this.loop;
    for (let i = a; i <= (b ?? a); i++) { const r = this.rectFor(i, "loop-hl"); if (r) this._loopRects.push(r); }
  }
}

/* ---------------------------------------------------------------- áudio */
class Engine {
  /* stems: [{url}] ; timeline: Timeline */
  constructor(timeline, { sampleRate } = {}) {
    this.tl = timeline;
    const AC = window.AudioContext || window.webkitAudioContext;
    try { this.ctx = sampleRate ? new AC({ sampleRate, latencyHint: "playback" }) : new AC({ latencyHint: "playback" }); }
    catch { this.ctx = new AC(); }
    const c = this.ctx;
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -3; this.limiter.knee.value = 3; this.limiter.ratio.value = 12;
    this.limiter.attack.value = .003; this.limiter.release.value = .2;
    this.limiter.connect(c.destination);
    this.bus = c.createGain(); // tudo que passa pelo SoundTouch quando a velocidade ≠ 100%
    this.bus.connect(this.limiter);
    this.clickGain = c.createGain(); this.clickGain.gain.value = .5; this.clickGain.connect(this.bus);
    this.stems = []; this.pos = 0; this.rate = 1; this.playingNow = false;
    this.metronome = true; this.countIn = false; this.loop = null;
    this.listeners = []; this.segments = []; this.voices = new Set();
  }
  on(fn) { this.listeners.push(fn); }
  emit() { for (const f of this.listeners) f(this); }

  async loadStems(urls, onProgress) {
    let done = 0;
    this.stems = urls.map(() => ({ buffer: null, gain: this.ctx.createGain() }));
    this.stems.forEach(s => s.gain.connect(this.bus));
    const queue = urls.map((u, i) => [u, i]);
    const worker = async () => {
      while (queue.length) {
        const [u, i] = queue.shift();
        const r = await fetch(u);
        if (!r.ok) throw new Error(`Falha ao baixar ${u}`);
        const ab = await r.arrayBuffer();
        this.stems[i].buffer = await new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej));
        done++; onProgress && onProgress(done / urls.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, urls.length) }, worker));
  }
  setGain(i, v) { const g = this.stems[i]?.gain.gain; if (g) g.setTargetAtTime(v, this.ctx.currentTime, .02); }

  async ensureStretch() {
    if (this.stNode !== undefined) return this.stNode;
    try {
      await this.ctx.audioWorklet.addModule(SOUNDTOUCH_URL);
      this.stNode = new AudioWorkletNode(this.ctx, "soundtouch-processor", {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { sampleBufferType: "circular" } });
    } catch (e) { console.warn("SoundTouch indisponível", e); this.stNode = null; }
    return this.stNode;
  }
  routeStretch(on) {
    this.bus.disconnect();
    if (on && this.stNode) {
      this.bus.connect(this.stNode); this.stNode.connect(this.limiter);
      this.stNode.parameters.get("playbackRate").value = this.rate;
      this.stNode.parameters.get("pitch").value = 1;
    } else this.bus.connect(this.limiter);
  }

  now() {
    if (!this.playingNow) return this.pos;
    const ct = this.ctx.currentTime;
    let s = this.segments[0];
    for (const x of this.segments) if (x.when <= ct) s = x;
    const p = s.from + Math.max(0, ct - s.when) * 1000 * this.rate;
    return Math.min(p, s.to);
  }
  async play({ countIn = this.countIn } = {}) {
    if (this.playingNow || !this.stems.length) return;
    if (this.ctx.state !== "running") await this.ctx.resume();
    if (this.rate !== 1) { await this.ensureStretch(); this.routeStretch(true); } else this.routeStretch(false);
    if (this.loop && (this.pos < this.loop[0] || this.pos >= this.loop[1])) this.pos = this.loop[0];
    if (this.pos >= this.tl.duration - 30) this.pos = this.loop ? this.loop[0] : 0;
    let when = this.ctx.currentTime + .06;
    if (countIn) {
      const { beatMs, beats } = this.tl.beatMsAt(this.pos);
      const b = beatMs / 1000 / this.rate;
      for (let i = 0; i < beats; i++) this.click(when + i * b, i === 0);
      when += beats * b;
    }
    this.playingNow = true; this.segments = [];
    this.startSegment(when, this.pos);
    this.timer = setInterval(() => this.tick(), 25); this.tick();
    const raf = () => { if (!this.playingNow) return; this.emit(); this.raf = requestAnimationFrame(raf); };
    raf();
  }
  startSegment(when, from) {
    const to = this.loop ? this.loop[1] : this.tl.duration;
    const seg = { when, from, to, end: when + (to - from) / 1000 / this.rate, srcs: [], beatIdx: lowerBound(this.tl.beats, from - 1, b => b.t) };
    for (const s of this.stems) {
      if (!s.buffer) continue;
      const src = this.ctx.createBufferSource();
      src.buffer = s.buffer; src.playbackRate.value = this.rate; src.connect(s.gain);
      src.start(when, from / 1000, Math.max(0, (to - from) / 1000));
      seg.srcs.push(src);
    }
    this.segments.push(seg);
    if (this.segments.length > 3) this.segments.shift();
  }
  tick() {
    const ct = this.ctx.currentTime, last = this.segments[this.segments.length - 1];
    // metrônomo: agenda os tempos dos próximos ~200 ms
    if (this.metronome) for (const seg of this.segments) {
      while (seg.beatIdx < this.tl.beats.length) {
        const b = this.tl.beats[seg.beatIdx];
        if (b.t >= seg.to - 1) { seg.beatIdx = this.tl.beats.length; break; }
        const w = seg.when + (b.t - seg.from) / 1000 / this.rate;
        if (w > ct + .2) break;
        if (w >= ct - .005) this.click(w, b.accent);
        seg.beatIdx++;
      }
    }
    if (this.loop && last.end - ct < .25 && !last.chained) { last.chained = true; this.startSegment(last.end, this.loop[0]); }
    if (!this.loop && ct >= last.end) { this.stopAll(); this.playingNow = false; this.pos = 0; clearInterval(this.timer); this.emit(); }
  }
  click(when, accent) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.value = accent ? 1600 : 1100;
    g.gain.setValueAtTime(.0001, when); g.gain.exponentialRampToValueAtTime(accent ? .9 : .6, when + .002);
    g.gain.exponentialRampToValueAtTime(.0001, when + .06);
    o.connect(g); g.connect(this.clickGain); o.start(when); o.stop(when + .08);
    this.voices.add(o); o.onended = () => this.voices.delete(o);
  }
  stopAll() {
    for (const s of this.segments) for (const x of s.srcs) { try { x.stop(); } catch {} }
    for (const o of this.voices) { try { o.stop(); } catch {} }
    this.voices.clear(); this.segments = [];
  }
  pause() {
    if (!this.playingNow) return;
    this.pos = this.now(); this.playingNow = false;
    clearInterval(this.timer); cancelAnimationFrame(this.raf); this.stopAll(); this.emit();
  }
  toggle() { this.playingNow ? this.pause() : this.play(); }
  stop() { this.pause(); this.pos = this.loop ? this.loop[0] : 0; this.emit(); }
  seek(ms, { autoplay = false, countIn = false } = {}) {
    const was = this.playingNow;
    if (was) { this.playingNow = false; clearInterval(this.timer); cancelAnimationFrame(this.raf); this.stopAll(); }
    this.pos = Math.max(0, Math.min(ms, this.tl.duration));
    if (was) this.play({ countIn: false });
    else if (autoplay) this.play({ countIn });
    else this.emit();
  }
  /* clique num compasso: toca a partir dele (ocorrência mais próxima da posição atual) */
  seekMeasure(m) {
    const k = this.tl.occurrence(m, this.now()); if (k == null) return;
    const t = this.tl.ev[k].t;
    if (this.loop && (t < this.loop[0] || t >= this.loop[1])) this.setLoop(null);
    this.seek(t, { autoplay: true, countIn: this.countIn });
  }
  async setRate(r) {
    const was = this.playingNow; if (was) this.pause();
    this.rate = r;
    if (r !== 1) await this.ensureStretch();
    if (was) this.play({ countIn: false });
  }
  setLoop(range) {
    const was = this.playingNow; if (was) this.pause();
    this.loop = range;
    if (range) this.pos = range[0];
    if (was) this.play({ countIn: false }); else this.emit();
  }
}
function lowerBound(arr, v, key) { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; key(arr[m]) < v ? lo = m + 1 : hi = m; } return lo; }

/* Tamanho da partitura: escala por largura de tela × zoom do músico (salvo no aparelho).
 * No celular: espaçamento mais justo e margens estreitas = mais compassos por linha. */
function scoreSizing(key, { phone, tablet, desktop }) {
  const s = { zoom: Stabat.load(key, 1) };
  s.scale = w => Math.round((w < 480 ? phone : w < 700 ? tablet : desktop) * s.zoom);
  s.vrv = w => w < 700 ? { spacingLinear: 0.18, spacingNonLinear: 0.5, pageMarginLeft: 8, pageMarginRight: 8, pageMarginTop: 24 } : {};
  s.bind = view => {
    const set = z => { s.zoom = Math.max(.6, Math.min(1.8, Math.round(z * 10) / 10)); Stabat.save(key, s.zoom); view._sc = null; view.relayout(); };
    document.getElementById("zin").onclick = () => set(s.zoom + .1);
    document.getElementById("zout").onclick = () => set(s.zoom - .1);
  };
  return s;
}
/* No celular, só o 1º sistema mostra o nome do instrumento (tira a abreviação dos seguintes). */
const noAbbrevOnPhone = xml => innerWidth < 700 ? xml.replace(/<part-abbreviation(-display)?>[\s\S]*?<\/part-abbreviation(-display)?>|<part-abbreviation\s*\/>/g, "") : xml;

/* Barra inferior fixa: publica a altura em --barh (espaço no fim da página e gaveta de instrumentos). */
(() => {
  const bar = document.querySelector(".sbar"); if (!bar) return;
  const upd = () => document.documentElement.style.setProperty("--barh", bar.offsetHeight + "px");
  new ResizeObserver(upd).observe(bar); upd();
})();

/* Reproduz/pausa com a barra de espaço (fora de campos de texto). */
function bindSpace(engine) {
  document.addEventListener("keydown", e => {
    if (e.code !== "Space" || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    e.preventDefault(); engine.toggle();
  });
}
