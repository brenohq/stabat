/** Página da parte: controle 0–100 (0 = só banda, 100 = só minha parte). */
export const DEFAULT_PART_MIX = 85;
/** realce da parte do músico: sozinha ela soa fraca perto da banda inteira (~3 dB) */
export const PART_BOOST = 1.4;

export function mixLevels(mix: number): { me: number; band: number } {
  return { me: mix / 100, band: (100 - mix) / 100 };
}

/** volumes reais: mantém a proporção do controle e põe o lado mais alto no volume cheio */
export function mixGains(mix: number): { me: number; band: number } {
  const l = mixLevels(mix);
  const top = Math.max(l.me, l.band) || 1;
  return { me: (l.me / top) * PART_BOOST, band: l.band / top };
}

/** Página do arranjo: com algum solo, só os solados tocam; senão, os ligados. */
export function partGain(i: number, on: ReadonlySet<number>, solo: ReadonlySet<number>): number {
  if (solo.size) return solo.has(i) ? 1 : 0;
  return on.has(i) ? 1 : 0;
}
