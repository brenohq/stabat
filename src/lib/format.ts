/** 75.4 → "1:15" */
export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** minúsculas e sem acento, para busca */
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** todas as palavras da busca aparecem no texto (ordem livre, sem acento) */
export function matches(query: string, text: string): boolean {
  const hay = normalize(text);
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => hay.includes(t));
}
