import { useState } from "react";
import { prefs } from "../lib/storage";
import { clampZoom } from "../score/sizing";

/** um zoom só, salvo no aparelho, para arranjo e parte (cada página aplica sobre o seu tamanho base) */
function savedZoom(): number {
  // antes havia um zoom por tipo de página: aproveita o da parte (o mais usado)
  return (
    prefs.get<number | null>("zoom", null) ?? prefs.get("zoomParte", null) ?? prefs.get("zoomArranjo", 1)
  );
}

export function useZoom(): [number, () => void, () => void] {
  const [zoom, setZoom] = useState(() => clampZoom(savedZoom()));
  const change = (d: number) =>
    setZoom((z) => {
      const n = clampZoom(z + d);
      prefs.set("zoom", n);
      return n;
    });
  return [zoom, () => change(0.1), () => change(-0.1)];
}
