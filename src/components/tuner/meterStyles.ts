import type { Zone } from "../../lib/tuner/tuning";

export type MeterStyle = "needle" | "bar" | "strobe";
export const METER_STYLES: [MeterStyle, string][] = [
  ["needle", "Ponteiro"],
  ["bar", "Barra"],
  ["strobe", "Estrobo"],
];

/** verde = afinado, amarelo = um pouco fora, vermelho = longe */
export const ZONE_COLOR: Record<Zone, string> = {
  ok: "var(--ok)",
  close: "var(--attention)",
  off: "var(--bad)",
};
