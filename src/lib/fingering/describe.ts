/** A digitação em palavras ("Pistões 1 e 3", "esquerda 1 2 3 · direita 1") e o que muda entre notas. */
import type { Fingering, Mechanism } from "./tables";

const KEY_NAMES: Record<string, Record<string, string>> = {
  sax: {
    oct: "oitava",
    bis: "bis",
    gs: "Sol♯",
    cs: "Dó♯ grave",
    lowb: "Si grave",
    lowbb: "Si♭ grave",
    eb: "Mi♭",
    lowc: "Dó grave",
    pd: "palma Ré",
    peb: "palma Mi♭",
    pf: "palma Fá",
    se: "lateral Mi",
  },
  clarinet: {
    reg: "registro",
    T: "polegar",
    akey: "chave do Lá",
    gs: "chave do Sol♯",
    cs: "Dó♯/Sol♯",
    fsc: "Fá♯/Dó♯",
    eb: "Mi/Si",
    fc: "Fá/Dó",
    gsd: "Sol♯/Ré♯",
    s4: "lateral Mi♭/Si♭",
  },
  recorder: {
    T: "polegar",
    Th: "meio polegar",
    R3h: "metade do 3 dir.",
    R4h: "metade do 4 dir.",
    bell: "ponta tampada",
  },
};
// o que vem antes das mãos na frase (o polegar e as chaves de registro)
const FIRST = new Set(["oct", "reg", "T", "Th"]);

const andList = (xs: string[]) =>
  xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}`;

export function keyName(mechanism: Mechanism, key: string): string {
  const m = /^([LR])(\d)$/.exec(key);
  if (m) return `${m[2]} ${m[1] === "L" ? "esq." : "dir."}`;
  return KEY_NAMES[mechanism]?.[key] ?? key;
}

export function describe(mechanism: Mechanism, f: Fingering): string {
  if (f.kind === "valves") {
    if (!f.valves.length) return "Nenhum pistão (solta)";
    return `${f.valves.length === 1 ? "Pistão" : "Pistões"} ${andList(f.valves.map(String))}`;
  }
  if (f.kind === "slide") return `${f.position}ª posição`;
  if (!f.keys.length) return "Tudo aberto";
  const hand = (side: "L" | "R") =>
    f.keys
      .filter((k) => k[0] === side && /^[LR]\d$/.test(k))
      .map((k) => k[1])
      .sort()
      .join(" ");
  const named = f.keys.filter((k) => !/^[LR]\d$/.test(k));
  const parts = [
    ...named.filter((k) => FIRST.has(k)).map((k) => keyName(mechanism, k)),
    hand("L") && `esquerda ${hand("L")}`,
    hand("R") && `direita ${hand("R")}`,
    ...named.filter((k) => !FIRST.has(k)).map((k) => keyName(mechanism, k)),
  ].filter(Boolean);
  return parts.join(" · ");
}

/** o que muda da nota anterior para esta, em texto curto; "" quando não há anterior */
export function changes(mechanism: Mechanism, prev: Fingering | null, cur: Fingering): string {
  if (!prev) return "";
  if (prev.kind === "slide" && cur.kind === "slide")
    return prev.position === cur.position
      ? "Mesma posição da nota anterior"
      : `Da ${prev.position}ª para a ${cur.position}ª posição`;
  const list = (f: Fingering) =>
    f.kind === "valves" ? f.valves.map(String) : f.kind === "keys" ? f.keys : [];
  const a = list(prev),
    b = list(cur);
  const name = (k: string) => (cur.kind === "valves" ? `pistão ${k}` : keyName(mechanism, k));
  const press = b.filter((k) => !a.includes(k)).map(name);
  const release = a.filter((k) => !b.includes(k)).map(name);
  if (!press.length && !release.length) return "Mesma digitação da nota anterior";
  return [press.length && `aperta ${andList(press)}`, release.length && `solta ${andList(release)}`]
    .filter(Boolean)
    .join(" · ");
}
