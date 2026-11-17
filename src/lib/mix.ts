import type { Loudness } from "./loudness";

/** Página da parte: controle 0–100 (0 = só banda, 100 = só minha parte). */
export const DEFAULT_PART_MIX = 90;
/** sem medição: realce fixo da parte do músico (~3 dB) */
export const PART_BOOST = 1.4;
/** a banda baixa 6 dB e a parte sobe até esse mesmo nível: sobra margem para os picos */
export const BAND_TRIM_DB = -6;
/** a parte nunca sobe mais que isso (partes quase vazias) */
const MAX_BOOST_DB = 30;
/** pico máximo da parte depois do ganho */
const PEAK_CEILING = 0.9;

export interface MatchGains {
  me: number;
  band: number;
}

const fromDb = (db: number) => 10 ** (db / 20);

/**
 * Ganhos que deixam a parte e a banda com o mesmo volume percebido. A banda
 * soma ~17 instrumentos e soa 12–24 dB acima de uma parte sozinha; sem isso o
 * controle só faz diferença perto dos 100%.
 */
export function matchGains(me: Loudness | null, band: Loudness | null): MatchGains {
  if (!me || !band || !Number.isFinite(me.db) || !Number.isFinite(band.db))
    return { me: PART_BOOST, band: 1 };
  const target = band.db + BAND_TRIM_DB;
  let g = fromDb(Math.min(MAX_BOOST_DB, target - me.db));
  if (me.peak > 0) g = Math.min(g, PEAK_CEILING / me.peak);
  return { me: g, band: fromDb(BAND_TRIM_DB) };
}

export function mixLevels(mix: number): { me: number; band: number } {
  return { me: mix / 100, band: (100 - mix) / 100 };
}

/**
 * Volumes reais: com a parte e a banda igualadas, o controle vale como
 * proporção de volume (50% = iguais; 90% = parte ~19 dB acima da banda).
 */
export function mixGains(
  mix: number,
  match: MatchGains = { me: PART_BOOST, band: 1 },
): { me: number; band: number } {
  const l = mixLevels(mix);
  const top = Math.max(l.me, l.band) || 1;
  return { me: (l.me / top) * match.me, band: (l.band / top) * match.band };
}

/** Página do arranjo: com algum solo, só os solados tocam; senão, os ligados. */
export function partGain(i: number, on: ReadonlySet<number>, solo: ReadonlySet<number>): number {
  if (solo.size) return solo.has(i) ? 1 : 0;
  return on.has(i) ? 1 : 0;
}
