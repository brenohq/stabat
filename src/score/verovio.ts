/** Verovio (MusicXML → SVG), carregado sob demanda: são ~7 MB. */
export interface TimemapEntry {
  tstamp: number;
  measureOn?: string;
  on?: string[];
}
export interface Toolkit {
  setOptions(o: Record<string, unknown>): void;
  loadData(data: string): boolean;
  getPageCount(): number;
  renderToSVG(page: number): string;
  renderToTimemap(o?: Record<string, unknown>): TimemapEntry[];
  redoLayout(): void;
}

let loading: Promise<() => Toolkit> | null = null;

export function loadVerovio(): Promise<() => Toolkit> {
  loading ??= (async () => {
    const [{ default: createModule }, { VerovioToolkit }] = await Promise.all([
      import("verovio/wasm"),
      import("verovio/esm"),
    ]);
    const mod = await createModule();
    return () => new VerovioToolkit(mod) as unknown as Toolkit;
  })();
  return loading;
}
