/**
 * Gancho de testes/depuração: com VITE_DEBUG=1 (dev e testes), a página atual publica
 * seus objetos em window.__stabat — os testes Playwright leem o motor de áudio e a partitura por aqui.
 */
export function exposeDebug(name: string, value: Record<string, unknown> | null): void {
  if (import.meta.env.VITE_DEBUG !== "1") return;
  const w = window as unknown as { __stabat?: Record<string, unknown> };
  w.__stabat ??= {};
  if (value) w.__stabat[name] = value;
  else delete w.__stabat[name];
}
