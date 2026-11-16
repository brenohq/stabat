import { loadVerovio, type Toolkit } from "./verovio";

interface ScoreViewOptions {
  /** escala do Verovio a partir da largura disponível */
  scale: (width: number) => number;
  /** opções extras do Verovio a partir da largura */
  layout?: (width: number) => Record<string, unknown>;
  /** transforma o MusicXML antes de carregar */
  transform?: (xml: string) => string;
  onMeasureClick?: (measure: number) => void;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Partitura desenhada pelo Verovio, com destaque do compasso atual, notas soando,
 * pautas apagadas (instrumentos desligados) e trecho de repetição. Imperativo de propósito:
 * a posição muda a cada quadro e não deve re-renderizar o React.
 */
export class ScoreView {
  private tk: Toolkit | null = null;
  private measureEls: SVGGElement[] = [];
  private mTimes: number[] = [];
  private events: { t: number; on: string[] }[] = [];
  private cur = -1;
  private hl: SVGRectElement | null = null;
  private loopRects: SVGRectElement[] = [];
  private playing: Element[] = [];
  private lastEv: number | null = null;
  private muted = new Set<number>();
  private mine: number | null = null;
  private mineRects: SVGRectElement[] = [];
  private loop: [number, number] | null = null;
  private lastKey = "";
  private ro: ResizeObserver | null = null;
  private disposed = false;
  /** px de barra fixa embaixo (para rolar sem esconder o compasso atrás dela) */
  bottomInset = () => 0;

  constructor(
    private readonly el: HTMLElement,
    private opts: ScoreViewOptions,
  ) {}

  get measureCount(): number {
    return this.measureEls.length;
  }

  async load(url: string): Promise<void> {
    const create = await loadVerovio();
    let xml = await (await fetch(url)).text();
    if (this.disposed) return;
    if (this.opts.transform) xml = this.opts.transform(xml);
    this.tk = create();
    this.tk.setOptions(this.vrvOptions());
    this.tk.loadData(xml);
    this.render();
    const tm = this.tk.renderToTimemap({ includeMeasures: true });
    this.mTimes = tm.filter((e) => e.measureOn).map((e) => e.tstamp);
    this.mTimes.push(tm.at(-1)?.tstamp ?? 0);
    this.events = tm.filter((e) => e.on?.length).map((e) => ({ t: e.tstamp, on: e.on! }));
    let t: ReturnType<typeof setTimeout>;
    this.ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => this.relayout(), 200);
    });
    this.ro.observe(this.el);
  }

  dispose(): void {
    this.disposed = true;
    this.ro?.disconnect();
  }

  setOptions(opts: ScoreViewOptions): void {
    this.opts = opts;
  }

  private width(): number {
    return Math.max(300, this.el.clientWidth - 8);
  }

  private vrvOptions(): Record<string, unknown> {
    const w = this.width();
    const scale = this.opts.scale(w);
    return {
      scale,
      pageWidth: Math.round((w * 100) / scale),
      adjustPageHeight: true,
      breaks: "auto",
      footer: "none",
      header: "none",
      pageMarginTop: 40,
      pageMarginBottom: 40,
      pageMarginLeft: 30,
      pageMarginRight: 30,
      svgHtml5: true,
      svgViewBox: true,
      systemMaxPerPage: 24,
      justifyVertically: false,
      expandNever: true, // ritornelos ficam por conta da linha do tempo do MuseScore
      ...(this.opts.layout?.(w) ?? {}),
    };
  }

  /** refaz a diagramação se a largura ou a escala mudaram */
  relayout(force = false): void {
    if (!this.tk) return;
    const o = this.vrvOptions();
    const key = `${o.pageWidth}/${o.scale}`;
    if (!force && key === this.lastKey) return;
    this.tk.setOptions(o);
    this.tk.redoLayout();
    this.render();
  }

  private render(): void {
    if (!this.tk) return;
    const o = this.vrvOptions();
    this.lastKey = `${o.pageWidth}/${o.scale}`;
    let html = "";
    for (let i = 1; i <= this.tk.getPageCount(); i++)
      html += `<div class="page">${this.tk.renderToSVG(i)}</div>`;
    this.el.innerHTML = html;
    this.measureEls = [...this.el.querySelectorAll<SVGGElement>("g.measure")];
    this.measureEls.forEach((m, i) => {
      // área clicável invisível: o compasso inteiro responde, não só as notas e linhas
      const bb = m.getBBox();
      const hit = document.createElementNS(SVG_NS, "rect");
      hit.setAttribute("class", "measure-hit");
      hit.setAttribute("x", String(bb.x));
      hit.setAttribute("y", String(bb.y - 60));
      hit.setAttribute("width", String(bb.width));
      hit.setAttribute("height", String(bb.height + 120));
      // estilo direto: o CSS do Verovio usa #id rect { stroke } e venceria uma classe
      hit.style.cssText = "fill:none;stroke:none;pointer-events:all";
      m.insertBefore(hit, m.firstChild);
      m.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.opts.onMeasureClick?.(i);
      });
    });
    const keep = this.cur;
    this.cur = -1;
    this.hl = null;
    this.playing = [];
    this.lastEv = null;
    if (keep >= 0) this.highlight(keep, false);
    this.applyMuted();
    this.drawMine();
    this.drawLoop();
  }

  private rectFor(i: number, cls: string): SVGRectElement | null {
    const m = this.measureEls[i];
    if (!m) return null;
    const bb = m.getBBox();
    const r = document.createElementNS(SVG_NS, "rect");
    r.setAttribute("class", cls);
    r.setAttribute("x", String(bb.x - 40));
    r.setAttribute("y", String(bb.y - 120));
    r.setAttribute("width", String(bb.width + 40));
    r.setAttribute("height", String(bb.height + 240));
    r.setAttribute("rx", "60");
    r.style.stroke = "none";
    m.insertBefore(r, m.firstChild);
    return r;
  }

  highlight(i: number, scroll = true): void {
    if (i === this.cur) return;
    this.cur = i;
    this.hl?.remove();
    this.hl = this.rectFor(i, "measure-hl");
    if (scroll && this.hl) this.scrollTo(i);
  }

  private scrollTo(i: number): void {
    const m = this.measureEls[i];
    if (!m) return;
    const r = (m.closest("g.system") ?? m).getBoundingClientRect();
    const bottom = this.bottomInset();
    if (r.top < 10 || r.bottom > innerHeight - bottom - 10)
      scrollBy({ top: r.top - (innerHeight - bottom) * 0.18, behavior: "smooth" });
  }

  /** colore as notas soando no compasso m, fração frac */
  markPlaying(m: number, frac: number): void {
    if (!this.events.length) return;
    const t0 = this.mTimes[m] ?? 0;
    const t1 = this.mTimes[m + 1] ?? t0;
    const ms = t0 + frac * (t1 - t0) + 1;
    let lo = 0,
      hi = this.events.length - 1,
      k = -1;
    while (lo <= hi) {
      const x = (lo + hi) >> 1;
      if (this.events[x]!.t <= ms) {
        k = x;
        lo = x + 1;
      } else hi = x - 1;
    }
    if (k === this.lastEv) return;
    this.lastEv = k;
    this.clearPlaying();
    this.lastEv = k;
    if (k < 0) return;
    for (const id of this.events[k]!.on) {
      const e = document.getElementById(id);
      if (e) {
        e.classList.add("playing");
        this.playing.push(e);
      }
    }
  }

  clearPlaying(): void {
    for (const e of this.playing) e.classList.remove("playing");
    this.playing = [];
    this.lastEv = null;
  }

  /** pautas (índice da parte) desligadas ficam apagadas */
  setMuted(set: Set<number>): void {
    this.muted = set;
    this.applyMuted();
  }

  private applyMuted(): void {
    for (const m of this.measureEls)
      m.querySelectorAll(":scope > g.staff").forEach((s, i) =>
        s.classList.toggle("muted", this.muted.has(i)),
      );
  }

  /** pauta (índice da parte) do músico: uma faixa colorida atrás dela em cada sistema */
  setMine(index: number | null): void {
    this.mine = index;
    this.drawMine();
  }

  private drawMine(): void {
    this.mineRects.forEach((r) => r.remove());
    this.mineRects = [];
    if (this.mine === null) return;
    for (const sys of this.el.querySelectorAll<SVGGElement>("g.system")) {
      let top = Infinity,
        bottom = -Infinity,
        right = -Infinity;
      for (const m of sys.querySelectorAll<SVGGElement>("g.measure")) {
        const staff = m.querySelectorAll(":scope > g.staff")[this.mine];
        if (!staff) continue;
        // as 5 linhas da pauta: a faixa não muda de altura com linhas suplementares
        for (const line of staff.querySelectorAll<SVGPathElement>(":scope > path")) {
          const b = line.getBBox();
          top = Math.min(top, b.y);
          bottom = Math.max(bottom, b.y + b.height);
          right = Math.max(right, b.x + b.width);
        }
      }
      if (!isFinite(top)) continue;
      const pad = (bottom - top) * 0.45; // ≈ 2 espaços da pauta
      const left = sys.getBBox().x; // inclui o nome do instrumento
      const band = this.svgRect("mine-hl", left - 40, top - pad, right - left + 80, bottom - top + 2 * pad);
      const edge = this.svgRect("mine-edge", left - 40, top - pad, 45, bottom - top + 2 * pad);
      sys.insertBefore(edge, sys.firstChild);
      sys.insertBefore(band, sys.firstChild);
      this.mineRects.push(band, edge);
    }
  }

  private svgRect(cls: string, x: number, y: number, w: number, h: number): SVGRectElement {
    const r = document.createElementNS(SVG_NS, "rect");
    r.setAttribute("class", cls);
    r.setAttribute("x", String(x));
    r.setAttribute("y", String(y));
    r.setAttribute("width", String(w));
    r.setAttribute("height", String(h));
    r.style.stroke = "none"; // o CSS do Verovio (#id rect { stroke }) venceria uma classe
    r.style.pointerEvents = "none";
    return r;
  }

  setLoop(range: [number, number] | null): void {
    this.loop = range;
    this.drawLoop();
  }

  private drawLoop(): void {
    this.loopRects.forEach((r) => r.remove());
    this.loopRects = [];
    if (!this.loop) return;
    for (let i = this.loop[0]; i <= this.loop[1]; i++) {
      const r = this.rectFor(i, "loop-hl");
      if (r) this.loopRects.push(r);
    }
  }
}
