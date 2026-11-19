import type { Collection } from "./collections";
import type { ArrangementMeta, ArrangementSummary } from "./types";

const ROOT = `${import.meta.env.BASE_URL}${import.meta.env.VITE_DATA_ROOT ?? "arranjos"}`;

/** pasta de dados da coleção, ex.: /arranjos ou /arranjos/quarteto */
function dir(c: Collection): string {
  return c.dataDir ? `${ROOT}/${c.dataDir}` : ROOT;
}

/** URL de um arquivo do arranjo, com a versão para não usar cache velho. */
export function assetUrl(c: Collection, meta: Pick<ArrangementMeta, "id" | "version">, path: string): string {
  return `${dir(c)}/${meta.id}/${path}?v=${meta.version}`;
}

export async function fetchIndex(c: Collection): Promise<ArrangementSummary[]> {
  const r = await fetch(`${dir(c)}/index.json`, { cache: "no-cache" });
  if (!r.ok) throw new Error("Não foi possível carregar o repertório");
  return r.json();
}

export async function fetchMeta(c: Collection, id: string): Promise<ArrangementMeta> {
  const r = await fetch(`${dir(c)}/${encodeURIComponent(id)}/meta.json`, { cache: "no-cache" });
  if (!r.ok) throw new Error("Arranjo não encontrado");
  return r.json();
}

export async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Não foi possível baixar ${url}`);
  return r.arrayBuffer();
}
