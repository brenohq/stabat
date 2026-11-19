import { createContext, useContext } from "react";
import { Outlet } from "react-router";
import { BANDA, type Collection } from "../lib/collections";

const Ctx = createContext<Collection>(BANDA);

/** coleção da página atual (banda, a não ser dentro de /quarteto) */
export function useCollection(): Collection {
  return useContext(Ctx);
}

/** elemento de rota que põe as rotas filhas dentro de uma coleção */
export function CollectionScope({ collection }: { collection: Collection }) {
  return (
    <Ctx.Provider value={collection}>
      <Outlet />
    </Ctx.Provider>
  );
}
