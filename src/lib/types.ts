/** Formato de arranjos/<id>/meta.json, gerado por tools/publicar.py. */
export interface Part {
  /** slug estável entre arranjos, ex.: "trompete-sib-1" */
  id: string;
  /** nome completo, ex.: "Trompete Sib 1" */
  name: string;
  /** posição na grade (0 = primeira pauta) e no áudio */
  index: number;
}

export interface RehearsalMark {
  /** índice do compasso na partitura (0 = primeiro) */
  m: number;
  label: string;
}

/** Um compasso tocado (os ritornelos repetem compassos). Tempos em ms do áudio. */
export interface TimelineEvent {
  m: number;
  t: number;
  end: number;
  beats: number;
}

export interface ArrangementMeta {
  id: string;
  title: string;
  subtitle: string;
  /** dois matizes (0–360) do degradê do cartão */
  hue: [number, number] | null;
  tempo: number;
  time: string;
  measures: number;
  /** segundos */
  duration: number;
  marks: RehearsalMark[];
  parts: Part[];
  timeline: TimelineEvent[];
  /** grid[parte][compasso] = 1 se a parte toca no compasso */
  grid: number[][];
  /** muda quando o .mscz muda (usado para invalidar cache dos arquivos) */
  version: string;
  /** taxa (Hz) em que o site decodifica o áudio; só nos arranjos longos (menos memória no celular) */
  sampleRate?: number;
  /** tamanho (bytes) de cada arquivo em audio/, ex.: {"tutti.mp3": 1396000}; ausente nos arranjos antigos */
  audio?: Record<string, number>;
}

export type ArrangementSummary = Pick<
  ArrangementMeta,
  "id" | "title" | "subtitle" | "hue" | "tempo" | "time" | "measures" | "duration" | "version"
> & { nparts: number };

export type Family = "wood" | "brass-hi" | "brass-lo";

export interface MyPart {
  id: string;
  name: string;
}
