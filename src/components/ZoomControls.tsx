import { ZoomInIcon, ZoomOutIcon } from "./icons";

export function ZoomControls({ onIn, onOut }: { onIn: () => void; onOut: () => void }) {
  const b =
    "grid h-9 w-[38px] cursor-pointer place-items-center text-ink hover:bg-surface-2 [&_svg]:size-[18px]";
  return (
    <div
      className="inline-flex overflow-hidden rounded-[10px] border border-line bg-surface"
      role="group"
      aria-label="Tamanho da partitura"
    >
      <button
        type="button"
        id="zout"
        className={b}
        onClick={onOut}
        title="Diminuir a partitura"
        aria-label="Diminuir a partitura"
      >
        <ZoomOutIcon />
      </button>
      <button
        type="button"
        id="zin"
        className={`${b} border-l border-line`}
        onClick={onIn}
        title="Aumentar a partitura"
        aria-label="Aumentar a partitura"
      >
        <ZoomInIcon />
      </button>
    </div>
  );
}
