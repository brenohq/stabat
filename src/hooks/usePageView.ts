import { useEffect } from "react";
import { useLocation } from "react-router";
import { trackPageView } from "../analytics";
import { useCollection } from "./useCollection";

/** entrada do histórico já contada (fora do componente: o StrictMode roda o efeito duas vezes) */
let counted = "";

/** põe o título da aba e conta a visita no Analytics, uma vez por navegação */
export function usePageView(title: string) {
  const col = useCollection();
  const { key } = useLocation();
  useEffect(() => {
    document.title = title;
    if (key === counted) return;
    counted = key;
    trackPageView(title, col.id);
  }, [title, key, col.id]);
}
