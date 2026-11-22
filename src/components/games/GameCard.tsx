import type { ReactNode } from "react";
import { btnClass } from "../btnClass";

/** peças comuns dos jogos: topo (nível, progresso da rodada, seguidas), tela por cima e fim de rodada */

export function GameHud({
  level,
  results,
  total,
  active,
  streak,
  flashKey,
  unit,
}: {
  level: string;
  results: boolean[];
  total: number;
  /** há uma pergunta em andamento (o próximo tracinho fica em destaque) */
  active: boolean;
  streak: number;
  /** muda a cada marco de sequência: as bolinhas piscam */
  flashKey?: number;
  /** o que a rodada conta: "notas", "exercícios" */
  unit: string;
}) {
  const inSet = streak === 0 ? 0 : ((streak - 1) % 5) + 1;
  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.5 sm:grid-cols-[auto_1fr_auto]">
      <span className="justify-self-start rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
        {level}
      </span>
      <div
        className="order-3 col-span-2 flex gap-1 sm:order-2 sm:col-span-1"
        aria-label={`${results.length} de ${total} ${unit} da rodada`}
      >
        {Array.from({ length: total }, (_, i) => (
          <i
            key={i}
            className={`h-2 flex-1 rounded transition-all ${
              i < results.length
                ? results[i]
                  ? "bg-ok"
                  : "bg-bad"
                : i === results.length && active
                  ? "scale-y-150 bg-accent"
                  : "bg-line"
            }`}
          />
        ))}
      </div>
      <div
        className="order-2 flex items-center gap-2 justify-self-end sm:order-3"
        aria-live="polite"
        data-testid="streak"
      >
        <span
          key={streak}
          className={`min-w-[1.4em] text-right font-display text-[26px] leading-none font-bold tabular-nums ${
            streak ? "g-bump" : ""
          }`}
        >
          {streak}
        </span>
        <div>
          <small className="block text-[11px] leading-tight text-muted">seguidas</small>
          <div key={flashKey ?? 0} className={`flex gap-[3px] ${flashKey ? "g-flash" : ""}`}>
            {[0, 1, 2, 3, 4].map((d) => (
              <i
                key={d}
                className={`size-[9px] rounded-full transition-all ${d < inSet ? "scale-110 bg-accent" : "bg-line"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Overlay({ children }: { children: ReactNode }) {
  return (
    <div
      className="g-fade absolute inset-0 z-10 grid place-items-center bg-surface/95 p-5"
      data-testid="game-overlay"
    >
      <div className="grid max-w-[380px] justify-items-center gap-3 text-center">{children}</div>
    </div>
  );
}

export function PrimaryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      autoFocus
      onClick={onClick}
      className={`${btnClass({ primary: true })} min-h-12 px-6 text-base`}
    >
      {children}
    </button>
  );
}

export function RoundEnd({
  stars,
  correct,
  total,
  best,
  unit,
  tip,
  onAgain,
  children,
}: {
  stars: 1 | 2 | 3;
  correct: number;
  total: number;
  best: number;
  /** "acertos", "compassos certos" */
  unit: string;
  tip: ReactNode;
  onAgain: () => void;
  /** algo a mais antes do botão (ex.: o andamento) */
  children?: ReactNode;
}) {
  return (
    <Overlay>
      <div className="flex gap-1.5 text-[40px] leading-none" aria-label={`${stars} de 3 estrelas`}>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={i <= stars ? "g-star text-accent" : "text-line"}
            style={{ animationDelay: `${(i - 1) * 0.15}s` }}
          >
            ★
          </span>
        ))}
      </div>
      <h2 className="text-[28px]">
        {stars === 3 ? "Excelente!" : stars === 2 ? "Muito bem!" : "Boa! Vamos de novo?"}
      </h2>
      <div className="flex justify-center gap-6">
        <div className="grid">
          <b className="font-display text-[26px] tabular-nums">
            {correct}/{total}
          </b>
          <span className="text-xs text-muted">{unit}</span>
        </div>
        <div className="grid">
          <b className="font-display text-[26px] tabular-nums">{best}</b>
          <span className="text-xs text-muted">melhor sequência</span>
        </div>
      </div>
      <p className="text-[13px] text-muted">{tip}</p>
      {children}
      <PrimaryButton onClick={onAgain}>Mais uma rodada</PrimaryButton>
    </Overlay>
  );
}
