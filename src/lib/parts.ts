import type { Family, Part, RehearsalMark } from "./types";

export function familyOf(name: string): Family {
  const n = name.toLowerCase();
  if (/clarinete|flauta|sax (alto|tenor|soprano|bar)/.test(n)) return "wood";
  if (/trompete|saxhorn|trompa/.test(n)) return "brass-hi";
  return "brass-lo";
}

export const FAMILY_LABEL: Record<Family, string> = {
  wood: "Madeiras",
  "brass-hi": "Metais agudos",
  "brass-lo": "Metais graves",
};

/** "Trompete Sib 1" → "Trompete 1" */
export function shortName(name: string): string {
  return name.replace(/ (Sib|Mib|Fá|Dó)\b/, "");
}

/** "Trompete Sib 1" → "1"; sem número → "" */
export function partNumber(name: string): string {
  return / (\d+)$/.exec(name)?.[1] ?? "";
}

/** partes agrupadas por família, na ordem da grade */
export function byFamily(parts: Part[]): [Family, Part[]][] {
  const out = new Map<Family, Part[]>();
  for (const p of parts) {
    const f = familyOf(p.name);
    if (!out.has(f)) out.set(f, []);
    out.get(f)!.push(p);
  }
  return [...out];
}

/** letra de ensaio vigente no compasso m */
export function sectionAt(marks: RehearsalMark[], m: number): string | null {
  let cur: string | null = null;
  for (const mk of marks) if (mk.m <= m) cur = mk.label;
  return cur;
}
