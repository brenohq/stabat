/**
 * Coleções de arranjos: o repertório da banda (em "/") e o do quarteto (em "/quarteto",
 * página escondida: não aparece em nenhum menu, só quem tem o link chega lá).
 * Cada coleção tem seus dados em arranjos/<pasta>/ e a sua própria "minha parte".
 */
export interface Collection {
  id: "banda" | "quarteto";
  /** prefixo das rotas ("" para a banda) */
  base: string;
  /** subpasta de arranjos/ com index.json e os arranjos ("" para a banda) */
  dataDir: string;
  /** o grupo que toca, em minúsculas: "banda" / "quarteto" (rótulos de volume, textos) */
  ensemble: string;
  /** o mesmo, com artigo: "a banda" / "o quarteto" */
  theEnsemble: string;
  /** nome do link de volta nas migalhas do topo */
  crumb: string;
  title: string;
  intro: string;
  /** chave da "minha parte" no localStorage (sem o prefixo stabat.) */
  myPartKey: string;
}

export const BANDA: Collection = {
  id: "banda",
  base: "",
  dataDir: "",
  ensemble: "banda",
  theEnsemble: "a banda",
  crumb: "Repertório",
  title: "Repertório da banda",
  intro: "Escolha um arranjo, ouça a banda inteira e estude a sua parte em casa.",
  myPartKey: "myPart",
};

export const QUARTETO: Collection = {
  id: "quarteto",
  base: "/quarteto",
  dataDir: "quarteto",
  ensemble: "quarteto",
  theEnsemble: "o quarteto",
  crumb: "Quarteto",
  title: "Repertório do quarteto",
  intro: "Sax tenor, trombone, bombardino e sousafone. Ouça o quarteto inteiro e estude a sua parte em casa.",
  myPartKey: "quarteto.myPart",
};

/** caminho de uma página da coleção: href(QUARTETO, "natal", "trombone") → "/quarteto/natal/trombone" */
export function href(c: Collection, ...segments: string[]): string {
  return [c.base, ...segments].join("/") || "/";
}
