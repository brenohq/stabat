/** classes do botão padrão (também usadas em links com cara de botão) */
export function btnClass({ on, primary }: { on?: boolean; primary?: boolean } = {}): string {
  const base =
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border px-3 py-1.5 text-sm transition-colors cursor-pointer [&_svg]:size-4";
  if (primary) return `${base} border-accent bg-accent font-semibold text-accent-ink hover:brightness-105`;
  if (on) return `${base} border-accent bg-accent-soft text-ink`;
  return `${base} border-line bg-surface text-ink hover:border-muted`;
}
