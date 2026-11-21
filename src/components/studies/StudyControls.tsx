import { Button } from "../ui";
import { BackIcon, MetronomeIcon, PauseIcon, PlayIcon } from "../icons";
import type { StudySession } from "../../hooks/useStudySession";

const BPMS = [40, 50, 60, 70, 80, 90, 100, 110, 120];

/** ‹ tocar › · metrônomo · andamento */
export function StudyControls({ s, playLabel }: { s: StudySession; playLabel: string }) {
  const at = BPMS.indexOf(s.bpm);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button aria-label="Nota anterior" onClick={() => s.select(s.index - 1)}>
        <BackIcon />
      </Button>
      <Button
        primary
        onClick={() => (s.player.playing ? s.player.stop() : void s.player.start())}
        className="min-w-[150px]"
        data-testid="study-play"
      >
        {s.player.playing ? <PauseIcon /> : <PlayIcon />}
        {s.player.playing ? "Parar" : playLabel}
      </Button>
      <Button aria-label="Próxima nota" onClick={() => s.select(s.index + 1)}>
        <BackIcon className="rotate-180" />
      </Button>
      <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
      <Button on={s.metronome} onClick={() => s.setMetronome((m) => !m)} aria-label="Metrônomo">
        <MetronomeIcon />
        <span className="max-sm:hidden">Metrônomo</span>
      </Button>
      <div className="flex items-center gap-1" role="group" aria-label="Andamento">
        <Button
          aria-label="Mais devagar"
          disabled={at === 0}
          onClick={() => s.setBpm(BPMS[Math.max(0, at - 1)]!)}
        >
          −
        </Button>
        <span className="w-[62px] text-center text-sm tabular-nums" data-testid="study-bpm">
          {s.bpm} bpm
        </span>
        <Button
          aria-label="Mais rápido"
          disabled={at === BPMS.length - 1}
          onClick={() => s.setBpm(BPMS[Math.min(BPMS.length - 1, at + 1)]!)}
        >
          +
        </Button>
      </div>
    </div>
  );
}
