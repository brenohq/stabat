import type { Part } from "./types";

export const MAX_COPIES = 99;

/** número digitado → cópias válidas (0 = campo vazio, ainda sem número) */
export function clampCopies(n: number): number {
  return Number.isFinite(n) ? Math.min(MAX_COPIES, Math.max(0, Math.trunc(n))) : 0;
}

/** cópias de cada parte: o que o músico já usou antes (por id da parte, vale para todos os arranjos) ou 1 */
export function initialCopies(parts: Part[], saved: Record<string, number>): Record<string, number> {
  return Object.fromEntries(parts.map((p) => [p.id, clampCopies(saved[p.id] ?? 1) || 1]));
}

export interface PrintItem {
  id: string;
  copies: number;
}

/** o que vai para o PDF: partes marcadas com pelo menos 1 cópia, na ordem da grade */
export function printJob(parts: Part[], selected: Set<string>, copies: Record<string, number>): PrintItem[] {
  return parts
    .filter((p) => selected.has(p.id) && (copies[p.id] ?? 0) > 0)
    .map((p) => ({ id: p.id, copies: copies[p.id]! }));
}

export function totalCopies(job: PrintItem[]): number {
  return job.reduce((s, j) => s + j.copies, 0);
}
