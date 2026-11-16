import { useEffect, useSyncExternalStore } from "react";
import type { Engine } from "../audio/engine";

const noop = () => () => {};

/**
 * Lê um valor do motor de áudio e re-renderiza só quando ele muda.
 * Use seletores que devolvem primitivos (número, booleano, string).
 */
export function useEngineValue<T extends string | number | boolean | null>(
  engine: Engine | null,
  select: (e: Engine) => T,
  fallback: T,
): T {
  return useSyncExternalStore(
    engine ? engine.subscribe : noop,
    () => (engine ? select(engine) : fallback),
    () => fallback,
  );
}

/** barra de espaço: tocar/pausar (fora de campos de formulário) */
export function useSpaceToggle(engine: Engine | null): void {
  useEffect(() => {
    if (!engine) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.code !== "Space" || /INPUT|SELECT|TEXTAREA|BUTTON/.test(t.tagName)) return;
      e.preventDefault();
      engine.toggle();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [engine]);
}

/** mantém a tela acesa enquanto toca (onde o navegador permitir) */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    navigator.wakeLock
      .request("screen")
      .then((l) => {
        if (cancelled) void l.release();
        else lock = l;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      void lock?.release();
    };
  }, [active]);
}
