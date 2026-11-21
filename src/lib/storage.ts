import type { Collection } from "./collections";
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

/** A parte do músico (uma por coleção: banda e quarteto têm formações diferentes).
 *  Sempre que ele escolhe uma parte, grava; os seletores usam a salva como padrão. */
export function myPartOf(c: Collection) {
  return {
    get: (): MyPart | null => read<MyPart | null>(c.myPartKey, null),
    set: (p: MyPart | null): void => write(c.myPartKey, p),
  };
}

export const prefs = {
  get: read,
  set: write,
};

/** cópias por parte na impressão (por id da parte; a formação da banda muda pouco entre arranjos) */
export const printCopies = {
  get: (): Record<string, number> => read<Record<string, number>>("printCopies", {}),
  set: (v: Record<string, number>): void => write("printCopies", v),
};

/** memória do jogo "Que nota é essa?" (caixas de cada nota); lida com scheduler.normalize */
export const noteGame = {
  get: (): unknown => read<unknown>("games.queNota", null),
  set: (v: unknown): void => write("games.queNota", v),
};

/** som dos jogos (ligado por padrão) */
export const gameSound = {
  get: (): boolean => read<boolean>("games.sound", true),
  set: (on: boolean): void => write("games.sound", on),
};

/** instrumento escolhido nos estudos (id de STUDY_INSTRUMENTS); sem escolha, vem da "minha parte" */
export const studyInstrument = {
  get: (): string | null => read<string | null>("studies.instrument", null),
  set: (id: string): void => write("studies.instrument", id),
};
