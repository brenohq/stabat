import { useEffect, useRef, type ReactNode } from "react";
import { RewindIcon } from "./icons";

/**
 * Barra de controles fixa no rodapé (arranjo e parte). Publica a própria altura em --barh,
 * usada para o espaço no fim da página, a gaveta de instrumentos e a rolagem da partitura.
 */
export function BottomBar({ top, bottom, wide }: { top: ReactNode; bottom: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const upd = () => document.documentElement.style.setProperty("--barh", `${el.offsetHeight}px`);
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    upd();
    return () => ro.disconnect();
  }, []);
  return (
    // vai 2px além da borda de baixo para não deixar fresta; respeita a área segura do iPhone
    <div
      ref={ref}
      data-testid="bottom-bar"
      className="fixed inset-x-0 -bottom-0.5 z-20 border-t border-line bg-surface pb-[calc(2px+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_30px_rgb(0_0_0/0.08)]"
    >
      <div
        className={`mx-auto flex flex-col gap-2 px-4 pt-2.5 pb-3 ${wide ? "max-w-[1400px]" : "max-w-[1060px]"}`}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{top}</div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">{bottom}</div>
      </div>
    </div>
  );
}

/** compasso, letra de ensaio e tempo */
export function Clock({
  measure,
  section,
  seconds,
  duration,
}: {
  measure: number;
  section: string | null;
  seconds: string;
  duration: string;
}) {
  return (
    <div className="text-[13px] whitespace-nowrap text-muted tabular-nums" data-testid="clock">
      <b className="text-[17px] font-semibold text-ink">
        c. <span data-testid="measure">{measure}</span>
      </b>{" "}
      {section && <span>· ensaio {section}</span>}
      <br />
      {seconds} / {duration}
    </div>
  );
}

/** volta ao início (ou ao início do trecho em loop); fica logo à direita do play */
export function RewindButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      id="rewind"
      onClick={onClick}
      title="Voltar ao início"
      aria-label="Voltar ao início"
      className="grid size-9 flex-none cursor-pointer place-items-center rounded-[10px] border border-line bg-surface text-ink hover:border-muted [&_svg]:size-[18px]"
    >
      <RewindIcon />
    </button>
  );
}

const RATES = [0.5, 0.6, 0.75, 0.9, 1];

/** velocidade de reprodução (sem mudar a afinação) */
export function SpeedSelect({ rate, onChange }: { rate: number; onChange: (rate: number) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-[13px] text-muted">
      Velocidade
      <select
        id="rate"
        value={rate}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-lg border border-line bg-surface px-2 py-1 text-ink"
      >
        {RATES.map((r) => (
          <option key={r} value={r}>
            {Math.round(r * 100)}%
          </option>
        ))}
      </select>
    </label>
  );
}
