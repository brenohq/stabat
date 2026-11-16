import type { MyPart } from "./types";

/** localStorage com tolerância a navegação privada / armazenamento bloqueado. */
function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(`stabat.${key}`);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) localStorage.removeItem(`stabat.${key}`);
    else localStorage.setItem(`stabat.${key}`, JSON.stringify(value));
  } catch {
    /* sem armazenamento: segue sem lembrar */
  }
}

/** A parte do músico. Sempre que ele escolhe uma parte, grava; os seletores usam a salva como padrão. */
export const myPart = {
  get: (): MyPart | null => read<MyPart | null>("myPart", null),
  set: (p: MyPart | null): void => write("myPart", p),
};

export const prefs = {
  get: read,
  set: write,
};
