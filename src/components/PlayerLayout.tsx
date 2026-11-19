import type { ReactNode } from "react";

/**
 * Esqueleto das páginas com player (arranjo e parte): ocupa exatamente a altura da tela,
 * o conteúdo rola numa área própria e a barra de controles fica embaixo como bloco normal.
 *
 * O documento nunca rola. Assim a barra de endereço do celular não encolhe/volta durante a
 * rolagem automática da partitura, que deixava a barra `fixed` "descolada" no meio da tela
 * (Safari do iPhone e Chrome do Android).
 */
export function PlayerLayout({ children, bar }: { children: ReactNode; bar: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <div
        data-scroll
        data-testid="scroll-area"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {children}
      </div>
      {bar}
    </div>
  );
}
