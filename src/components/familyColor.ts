import type { Family } from "../lib/types";

/** cor de cada família (mixer, seletor de parte) */
export const FAMILY_COLOR: Record<Family, string> = {
  wood: "bg-wood",
  "brass-hi": "bg-brass-hi",
  "brass-lo": "bg-brass-lo",
};

/** selo suave: fundo claro e traço na cor da família (ícone do instrumento no seletor) */
export const FAMILY_SOFT: Record<Family, string> = {
  wood: "bg-wood/12 text-wood",
  "brass-hi": "bg-brass-hi/14 text-brass-hi",
  "brass-lo": "bg-brass-lo/12 text-brass-lo",
};
