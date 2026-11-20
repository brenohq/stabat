import { PauseIcon, PlayIcon } from "./icons";

const R = 26;
const L = 2 * Math.PI * R;

/**
 * play/pausa; enquanto o áudio baixa, mostra um anel de progresso em volta. O áudio só é
 * baixado no primeiro play: até chegar, o botão mostra pausa (clicar de novo desiste).
 */
export function PlayButton({
  playing,
  waiting,
  progress,
  size,
  onClick,
}: {
  playing: boolean;
  /** apertou play e o áudio ainda está chegando */
  waiting: boolean;
  /** 0–1 enquanto baixa; null quando não há nada baixando */
  progress: number | null;
  /** tamanho do download, mostrado na dica enquanto o áudio não foi baixado (ex.: "1,4 MB") */
  size?: string | null;
  onClick: () => void;
}) {
  const loading = progress !== null && progress < 1;
  const label = waiting ? "Carregando áudio" : playing ? "Pausar" : "Tocar";
  return (
    <button
      type="button"
      id="play"
      onClick={onClick}
      aria-label={label}
      aria-busy={loading}
      title={size && !playing && !waiting ? `Tocar (baixa ${size} de áudio)` : label}
      data-playing={playing}
      className="relative grid size-12 flex-none cursor-pointer place-items-center rounded-full bg-accent text-accent-ink shadow-[0_4px_14px_rgb(168_118_28/0.35)] active:scale-95"
    >
      {playing || waiting ? <PauseIcon className="size-[22px]" /> : <PlayIcon className="size-[22px]" />}
      {loading && (
        <svg
          viewBox="0 0 56 56"
          className="pointer-events-none absolute -inset-1 size-[calc(100%+8px)] -rotate-90"
        >
          <circle cx="28" cy="28" r={R} fill="none" stroke="var(--line)" strokeWidth="3" />
          <circle
            cx="28"
            cy="28"
            r={R}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={L}
            strokeDashoffset={L * (1 - (progress ?? 0))}
            className="transition-[stroke-dashoffset] duration-200"
          />
        </svg>
      )}
    </button>
  );
}
