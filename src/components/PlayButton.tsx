import { PauseIcon, PlayIcon } from "./icons";

const R = 26;
const L = 2 * Math.PI * R;

/** play/pausa; enquanto o áudio carrega, mostra um anel de progresso em volta */
export function PlayButton({
  playing,
  progress,
  onClick,
}: {
  playing: boolean;
  /** 0–1 enquanto carrega; 1 ou null quando pronto */
  progress: number | null;
  onClick: () => void;
}) {
  const loading = progress !== null && progress < 1;
  return (
    <button
      type="button"
      id="play"
      onClick={onClick}
      disabled={loading}
      aria-label={loading ? "Carregando áudio" : playing ? "Pausar" : "Tocar"}
      data-playing={playing}
      className="relative grid size-12 flex-none cursor-pointer place-items-center rounded-full bg-accent text-accent-ink shadow-[0_4px_14px_rgb(168_118_28/0.35)] active:scale-95 disabled:cursor-progress"
    >
      {playing ? <PauseIcon className="size-[22px]" /> : <PlayIcon className="size-[22px]" />}
      {loading && (
        <svg
          viewBox="0 0 56 56"
          className="pointer-events-none absolute -inset-1 size-[calc(100%+8px)] -rotate-90"
        >
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
