/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Pasta (relativa à base do site) com index.json e os arranjos. Padrão: "arranjos". */
  readonly VITE_DATA_ROOT?: string;
  /** "1" expõe window.__stabat para testes e depuração. */
  readonly VITE_DEBUG?: string;
}

declare module "verovio/wasm" {
  const createVerovioModule: () => Promise<unknown>;
  export default createVerovioModule;
}
declare module "verovio/esm" {
  export class VerovioToolkit {
    constructor(module: unknown);
  }
}
