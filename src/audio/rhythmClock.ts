/**
 * Relógio do "Bate o ritmo". Tudo no relógio do AudioContext (nada de setTimeout para o ritmo):
 * os cliques são agendados com antecedência e os toques são convertidos para esse mesmo relógio.
 *
 * "Hora ouvida" = hora do AudioContext − atraso de saída (o que o navegador informa) − o ajuste
 * do aparelho (medido pelo músico tocando junto com cliques). É nela que os toques são comparados.
 */
import { audio, click } from "./sfx";

export class RhythmClock {
  private nodes: OscillatorNode[] = [];
  /** ajuste do aparelho, em ms (positivo = os toques chegam atrasados) */
  calibrationMs = 0;

  get ctx(): AudioContext | null {
    return audio();
  }

  /** atraso de saída que o navegador informa (s) */
  outputLatency(): number {
    const a = this.ctx;
    return a ? a.outputLatency || a.baseLatency || 0 : 0;
  }

  /** agora, na hora do AudioContext */
  now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /** o que o músico está ouvindo agora, na hora em que os cliques foram agendados */
  heardNow(): number {
    return this.now() - this.outputLatency();
  }

  /** hora (do AudioContext, já corrigida) de um toque; `timeStamp` do evento desconta a demora até o código */
  tapTime(timeStamp?: number): number {
    const lag = timeStamp ? Math.min(0.08, Math.max(0, (performance.now() - timeStamp) / 1000)) : 0;
    return this.now() - lag - this.outputLatency() - this.calibrationMs / 1000;
  }

  /** agenda cliques (hora do AudioContext); `first` = acentuado */
  clicks(times: { at: number; accent: boolean }[]): void {
    for (const c of times) {
      const o = click(c.accent, c.at);
      if (o) this.nodes.push(o);
    }
  }

  /** cancela os cliques que ainda não tocaram */
  stop(): void {
    const t = this.now();
    for (const o of this.nodes) {
      try {
        o.stop(t);
      } catch {
        /* já parou */
      }
    }
    this.nodes = [];
  }
}
