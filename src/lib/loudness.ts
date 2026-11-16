/** Volume percebido de um áudio, para igualar "minha parte" e "banda". */
export interface Loudness {
  /** nível médio em dBFS, só nos trechos que soam (pausas não puxam para baixo) */
  db: number;
  /** pico absoluto (0..1) */
  peak: number;
}

const BLOCK_S = 0.4;
const ABS_GATE_DB = -70;
const REL_GATE_DB = -10;

/**
 * Média quadrática em blocos de 400 ms com os portões do EBU R128
 * (absoluto em −70 dB, relativo 10 dB abaixo da média). Sem o filtro K:
 * serve para comparar partes da mesma gravação.
 */
export function measureLoudness(channels: readonly Float32Array[], sampleRate: number): Loudness {
  const len = channels[0]?.length ?? 0;
  const block = Math.max(1, Math.round(BLOCK_S * sampleRate));
  const blocks: number[] = [];
  let peak = 0;
  for (let start = 0; start < len; start += block) {
    const end = Math.min(len, start + block);
    let sum = 0;
    for (const ch of channels)
      for (let i = start; i < end; i++) {
        const x = ch[i]!;
        sum += x * x;
        const a = x < 0 ? -x : x;
        if (a > peak) peak = a;
      }
    blocks.push(sum / ((end - start) * channels.length));
  }
  const toDb = (ms: number) => 10 * Math.log10(ms);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const loud = blocks.filter((ms) => ms > 0 && toDb(ms) > ABS_GATE_DB);
  if (!loud.length) return { db: -Infinity, peak };
  const gate = toDb(mean(loud)) + REL_GATE_DB;
  const kept = loud.filter((ms) => toDb(ms) > gate);
  return { db: toDb(mean(kept)), peak };
}
