/**
 * "Smells": notas fora da extensão confortável de cada instrumento, em altura **escrita**
 * (todas as partes da banda estão em clave de Sol). Embaixo, Dó grave (Dó4) para todos;
 * em cima depende do instrumento.
 */
export interface SmellRange {
  /** nota mais grave permitida (MIDI, escrita) */
  low: number;
  /** nota mais aguda permitida (MIDI, escrita) */
  high: number;
}

const DO4 = 60;
/** regra geral: Dó4 a Sol5 */
export const DEFAULT_RANGE: SmellRange = { low: DO4, high: 79 };
const RANGES: { test: RegExp; range: SmellRange }[] = [
  // Sax Alto e Sax Tenor (não confundir com Saxhorn): até o Dó6, 2ª linha suplementar
  { test: /^sax (alto|tenor)\b/i, range: { low: DO4, high: 84 } },
  // Clarinetes: até o Si5
  { test: /^clarinete\b/i, range: { low: DO4, high: 83 } },
];

/** extensão permitida para a parte, pelo nome ("Sax Alto Mib 1", "Clarinete Sib 2"…) */
export function smellRange(partName: string): SmellRange {
  return RANGES.find((r) => r.test.test(partName.trim()))?.range ?? DEFAULT_RANGE;
}

export function isSmell(midi: number, range: SmellRange = DEFAULT_RANGE): boolean {
  return midi > range.high || midi < range.low;
}

export interface SmellNote {
  /** índice do compasso (0 = primeiro) */
  m: number;
  /** altura escrita (MIDI) */
  pitch: number;
}

export interface SmellReport {
  high: number;
  low: number;
  /** compassos com alguma nota fora, em ordem */
  measures: number[];
}

export function smellReport(notes: SmellNote[], range: SmellRange = DEFAULT_RANGE): SmellReport {
  let high = 0;
  let low = 0;
  const ms = new Set<number>();
  for (const n of notes) {
    if (n.pitch > range.high) high++;
    else if (n.pitch < range.low) low++;
    else continue;
    ms.add(n.m);
  }
  return { high, low, measures: [...ms].sort((a, b) => a - b) };
}

const NAMES = ["Dó", "Dó♯", "Ré", "Mi♭", "Mi", "Fá", "Fá♯", "Sol", "Sol♯", "Lá", "Si♭", "Si"];

/** nome da nota com oitava (60 → "Dó4") */
export function pitchName(midi: number): string {
  return `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * Alturas escritas de todas as notas de um MusicXML (partwise, uma parte), sem desenhar nada.
 * Serve para contar os smells das outras partes do arranjo; o compasso é a ordem de <measure>.
 */
export function writtenPitches(xml: string): SmellNote[] {
  const out: SmellNote[] = [];
  const measures = xml.match(/<measure\b[\s\S]*?<\/measure>/g) ?? [];
  measures.forEach((body, m) => {
    for (const [, pitch] of body.matchAll(/<note\b[^>]*>[\s\S]*?<pitch>([\s\S]*?)<\/pitch>/g)) {
      const step = /<step>\s*([A-G])\s*<\/step>/.exec(pitch!)?.[1];
      const oct = /<octave>\s*(-?\d+)\s*<\/octave>/.exec(pitch!)?.[1];
      if (!step || oct === undefined) continue;
      const alter = Number(/<alter>\s*([-\d.]+)\s*<\/alter>/.exec(pitch!)?.[1] ?? 0);
      out.push({ m, pitch: (Number(oct) + 1) * 12 + STEP[step]! + Math.round(alter) });
    }
  });
  return out;
}
