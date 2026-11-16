import type { ButtonHTMLAttributes, ReactNode } from "react";
import { btnClass } from "./btnClass";

/** botão padrão; "on" = ligado (metrônomo, contagem, trecho) */
export function Button({
  on,
  primary,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={`${btnClass({ on, primary })} ${className}`}
      {...rest}
    />
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-[14px] border border-line bg-surface shadow-card ${className}`}>{children}</div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="px-5 py-16 text-center text-sm text-[#8b8170]" role="status">
      {label}
      <div className="relative mx-auto mt-3.5 h-[3px] w-40 overflow-hidden rounded bg-[#eadfca]">
        <div className="absolute inset-y-0 w-2/5 animate-[loading-bar_1s_ease-in-out_infinite] bg-accent" />
      </div>
    </div>
  );
}
