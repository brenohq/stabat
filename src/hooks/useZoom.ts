import { useState } from "react";
import { prefs } from "../lib/storage";
import { clampZoom } from "../score/sizing";

/** zoom da partitura salvo no aparelho (um por tipo de página) */
export function useZoom(key: string): [number, () => void, () => void] {
  const [zoom, setZoom] = useState(() => clampZoom(prefs.get(key, 1)));
  const change = (d: number) =>
    setZoom((z) => {
      const n = clampZoom(z + d);
      prefs.set(key, n);
      return n;
    });
  return [zoom, () => change(0.1), () => change(-0.1)];
}
