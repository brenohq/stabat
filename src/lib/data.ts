import type { ArrangementMeta, ArrangementSummary } from "./types";

const ROOT = `${import.meta.env.BASE_URL}${import.meta.env.VITE_DATA_ROOT ?? "arranjos"}`;

/** URL de um arquivo do arranjo, com a versão para não usar cache velho. */
export function assetUrl(meta: Pick<ArrangementMeta, "id" | "version">, path: string): string {
  return `${ROOT}/${meta.id}/${path}?v=${meta.version}`;
}

export async function fetchIndex(): Promise<ArrangementSummary[]> {
  const r = await fetch(`${ROOT}/index.json`, { cache: "no-cache" });
  if (!r.ok) throw new Error("Não foi possível carregar o repertório");
  return r.json();
}

export async function fetchMeta(id: string): Promise<ArrangementMeta> {
  const r = await fetch(`${ROOT}/${encodeURIComponent(id)}/meta.json`, { cache: "no-cache" });
  if (!r.ok) throw new Error("Arranjo não encontrado");
  return r.json();
}

export async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Não foi possível baixar ${url}`);
  return r.arrayBuffer();
}
