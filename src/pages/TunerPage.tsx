import { useEffect, useRef, useState } from "react";
import { audio, drone, stopSfx } from "../audio/sfx";
import { CheckIcon, MicIcon } from "../components/icons";
import { StudyInstrumentPicker } from "../components/studies/StudyInstrumentPicker";
import { TopBar } from "../components/TopBar";
import { METER_STYLES, ZONE_COLOR, type MeterStyle } from "../components/tuner/meterStyles";
import { TunerMeter } from "../components/tuner/TunerMeter";
import { Button, Card } from "../components/ui";
import { exposeDebug } from "../debug";
import { useMicPitch, useWakeLock, type MicPitch, type MicStatus } from "../hooks/useMicPitch";
import { usePageView } from "../hooks/usePageView";
import { BANDA } from "../lib/collections";
import {
  DEFAULT_STUDY_INSTRUMENT,
  studyInstrumentById,
  studyInstrumentForPart,
  type StudyInstrument,
} from "../lib/fingering/instruments";
import { myPartOf, tunerPrefs } from "../lib/storage";
import {
  A4_MAX,
  A4_MIN,
  advanceHold,
  advice,
  centsFrom,
  frequencyOf,
  nearestMidi,
  noteLabel,
  referenceMidi,
  ROUND_INSTRUMENTS,
  TUNING_MIDI,
  WRONG_NOTE_CENTS,
  writtenMidi,
  zoneOf,
} from "../lib/tuner/tuning";

type Mode = "tune" | "round";

/** o instrumento do "Afinar": o escolhido antes; senão o da "minha parte"; senão a flauta doce */
function initialInstrument(): StudyInstrument {
  const saved = studyInstrumentById(tunerPrefs.instrument.get());
  if (saved) return saved;
  const part = myPartOf(BANDA).get();
  return (part && studyInstrumentForPart(part.name)) || studyInstrumentById(DEFAULT_STUDY_INSTRUMENT)!;
}

const MIC_ERRORS: Partial<Record<MicStatus, string>> = {
  denied:
    "O navegador não deixou usar o microfone. Toque no cadeado ao lado do endereço, permita o microfone e tente de novo.",
  "no-device": "Nenhum microfone encontrado neste aparelho.",
  unsupported: "Este navegador não dá acesso ao microfone. Tente no Chrome ou no Safari atualizados.",
  failed: "Não foi possível ligar o microfone. Tente de novo.",
};

const fmtCents = (c: number) => `${c > 0 ? "+" : c < 0 ? "−" : "±"}${Math.abs(Math.round(c))}`;
const fmtHz = (f: number) => `${f.toFixed(1).replace(".", ",")} Hz`;

/** /afinador: o maestro afina a banda antes do ensaio (ou o músico afina em casa) */
export function TunerPage() {
  usePageView("stabat · Afinador");
  const [mode, setModeState] = useState<Mode>(() => tunerPrefs.mode.get());
  const [tuneInst, setTuneInst] = useState(initialInstrument);
  const [roundInst, setRoundInst] = useState(ROUND_INSTRUMENTS[0]!);
  const [tuned, setTuned] = useState<Record<string, number>>({});
  const [hold, setHold] = useState(0);
  const [style, setStyleState] = useState<MeterStyle>(() => tunerPrefs.display.get());
  const [a4, setA4State] = useState(() => tunerPrefs.a4.get());
  const [refOn, setRefOn] = useState(false);

  const inst = mode === "tune" ? tuneInst : roundInst;
  const target = noteLabel(writtenMidi(inst));

  // o que a leitura do microfone precisa saber (ela roda fora da renderização)
  const live = useRef({ mode, inst, a4, tuned, hold: 0, last: 0 });
  useEffect(() => {
    Object.assign(live.current, { mode, inst, a4, tuned });
  });

  const onPitch = (p: MicPitch) => {
    const s = live.current;
    const dt = s.last ? Math.min(0.25, (p.at - s.last) / 1000) : 0;
    s.last = p.at;
    if (s.mode !== "round") return;
    const c = p.freq === null ? null : centsFrom(p.freq, TUNING_MIDI, s.a4);
    s.hold = advanceHold(s.hold, dt, c !== null && zoneOf(c) === "ok");
    setHold(s.hold);
    if (s.hold >= 1 && c !== null && !(s.inst.id in s.tuned)) {
      s.tuned = { ...s.tuned, [s.inst.id]: Math.round(c) };
      setTuned(s.tuned);
      navigator.vibrate?.(80);
    }
  };
  const { status, pitch, start, stop } = useMicPitch(onPitch);
  const on = status === "on";
  useWakeLock(on);

  const cents = on && pitch.freq !== null ? centsFrom(pitch.freq, TUNING_MIDI, a4) : null;
  const wrong = cents !== null && Math.abs(cents) > WRONG_NOTE_CENTS;
  const zone = cents === null ? null : zoneOf(cents);

  // nota de referência: o Lá na região do instrumento
  const refHz = frequencyOf(referenceMidi(inst), a4);
  useEffect(() => {
    if (!refOn) return;
    return drone(refHz);
  }, [refOn, refHz]);
  useEffect(() => () => stopSfx(), []);

  useEffect(() => {
    exposeDebug("tuner", {
      state: () => ({ status, mode, inst: inst.id, note: target.name, freq: pitch.freq, cents, hold, tuned }),
    });
    return () => exposeDebug("tuner", null);
  });

  const resetHold = () => {
    live.current.hold = 0;
    setHold(0);
  };
  const setMode = (m: Mode) => {
    setModeState(m);
    tunerPrefs.mode.set(m);
    resetHold();
  };
  const chooseTune = (id: string) => {
    const next = studyInstrumentById(id);
    if (!next) return;
    setTuneInst(next);
    tunerPrefs.instrument.set(id);
  };
  const chooseRound = (next: StudyInstrument) => {
    setRoundInst(next);
    resetHold();
  };
  const setStyle = (s: MeterStyle) => {
    setStyleState(s);
    tunerPrefs.display.set(s);
  };
  const setA4 = (v: number) => {
    const next = Math.max(A4_MIN, Math.min(A4_MAX, v));
    setA4State(next);
    tunerPrefs.a4.set(next);
  };
  const toggleRef = () => {
    if (!refOn) audio(); // acorda o som dentro do toque (iPhone)
    setRefOn((v) => !v);
  };

  let message: string;
  if (MIC_ERRORS[status]) message = MIC_ERRORS[status]!;
  else if (!on) message = status === "starting" ? "Ligando o microfone…" : "Ligue o microfone para começar.";
  else if (cents === null) message = `Toque o ${target.name} (${target.letter}) e segure a nota.`;
  else if (wrong) {
    const played = noteLabel(nearestMidi(pitch.freq!, a4) - inst.transpose);
    message = `Essa nota é ${played.name}. Toque o ${target.name} (${target.letter}).`;
  } else message = advice(inst, cents);
  const tone =
    MIC_ERRORS[status] || wrong
      ? "bg-bad-soft text-bad"
      : zone === "ok"
        ? "bg-ok-soft text-ok font-semibold"
        : zone === "close"
          ? "bg-[color-mix(in_srgb,var(--attention)_18%,transparent)] text-ink"
          : zone === "off"
            ? "bg-bad-soft text-bad"
            : "bg-surface-2 text-muted";

  const nTuned = Object.keys(tuned).length;

  return (
    <>
      <TopBar crumbs={<>Afinador</>} />
      <div className="bg-navy px-4 pt-6 pb-[70px] text-[#f3eee4]">
        <div className="mx-auto max-w-[760px] px-4">
          <h1 className="text-[clamp(26px,5vw,38px)]">Afinador</h1>
          <p className="mt-2 max-w-[560px] opacity-75">
            A banda afina no Lá de concerto. Cada músico vê a nota que ele lê, quanto está alto ou baixo e o
            que mexer no instrumento.
          </p>
        </div>
      </div>
      <main className="mx-auto -mt-12 mb-16 max-w-[760px] px-4">
        <Card className="flex flex-col gap-4 p-4 sm:p-5">
          <div data-testid="tuner" className="flex flex-col gap-4">
            <div
              role="group"
              aria-label="Modo"
              className="flex rounded-[12px] border border-line bg-surface-2 p-1"
            >
              {(
                [
                  ["tune", "Afinar"],
                  ["round", "Rodada da banda"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-[9px] px-3 py-2 text-sm transition-colors ${
                    mode === m ? "bg-surface font-semibold text-ink shadow-card" : "text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "tune" ? (
              <div className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted">
                <span aria-hidden>Instrumento</span>
                <StudyInstrumentPicker
                  value={tuneInst}
                  onChange={chooseTune}
                  label="Instrumento"
                  className="w-full text-[15px] font-normal text-ink sm:w-[280px]"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted">
                    Toque no instrumento que vai afinar.{" "}
                    <span className="whitespace-nowrap" data-testid="round-count">
                      {nTuned} de {ROUND_INSTRUMENTS.length} afinados
                    </span>
                  </p>
                  {nTuned > 0 && (
                    <Button
                      onClick={() => {
                        live.current.tuned = {};
                        setTuned({});
                        resetHold();
                      }}
                    >
                      Recomeçar
                    </Button>
                  )}
                </div>
                <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                  {ROUND_INSTRUMENTS.map((i) => {
                    const cur = i.id === roundInst.id;
                    const done = i.id in tuned;
                    return (
                      <li key={i.id}>
                        <button
                          type="button"
                          data-testid="round-item"
                          aria-pressed={cur}
                          onClick={() => chooseRound(i)}
                          className={`flex w-full items-center gap-1.5 rounded-[10px] border px-2.5 py-2 text-left text-[13px] leading-tight transition-colors ${
                            cur
                              ? "border-[var(--mine-edge)] bg-[var(--mine)] font-semibold"
                              : "border-line bg-surface hover:border-muted"
                          }`}
                        >
                          <span className="min-w-0 flex-1">{i.name}</span>
                          {done && (
                            <CheckIcon
                              className="size-4 flex-none text-ok"
                              aria-label={`afinado (${fmtCents(tuned[i.id]!)} cents)`}
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <section
              aria-label="Leitura"
              className="flex flex-col items-center gap-2 rounded-[14px] border border-line bg-surface-2 px-3 pt-4 pb-3"
            >
              <p className="text-xs font-semibold tracking-wider text-muted uppercase">
                {mode === "round" ? roundInst.name : "Toque"}
              </p>
              <p
                data-testid="tuner-note"
                className="font-display text-[64px] leading-none font-semibold sm:text-[76px]"
                style={{ color: zone === "ok" ? "var(--ok)" : undefined }}
              >
                {target.name}
              </p>
              <span className="h-1 w-12 rounded" style={{ background: target.color }} aria-hidden />
              <p className="text-[13px] text-muted">{target.letter} · soa Lá de concerto</p>
              <div className="relative w-full">
                <TunerMeter cents={cents} style={style} />
                {!on && (
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="flex flex-col items-center gap-1.5 rounded-[14px] bg-surface/90 px-4 py-3 shadow-card">
                      <Button
                        primary
                        onClick={() => void start()}
                        disabled={status === "starting"}
                        className="!px-5 !py-3 !text-base"
                      >
                        <MicIcon />
                        {MIC_ERRORS[status] ? "Tentar de novo" : "Ligar o microfone"}
                      </Button>
                      <span className="text-xs text-muted">O som fica só no seu aparelho.</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex w-full max-w-[420px] items-baseline justify-between gap-2 tabular-nums">
                <span className="text-xs text-muted">
                  {pitch.freq !== null && on ? fmtHz(pitch.freq) : "— Hz"}
                </span>
                <span
                  data-testid="tuner-cents"
                  className="text-2xl font-bold"
                  style={{
                    // o amarelo puro some no papel claro: escurece só o texto
                    color:
                      zone === "close"
                        ? "color-mix(in srgb, var(--attention) 62%, var(--ink))"
                        : zone
                          ? ZONE_COLOR[zone]
                          : "var(--muted)",
                  }}
                >
                  {cents === null ? "—" : `${fmtCents(cents)} cents`}
                </span>
                <span className="text-xs text-muted">Lá = {a4} Hz</span>
              </div>
              <p
                data-testid="tuner-advice"
                role="status"
                className={`grid min-h-[52px] w-full max-w-[420px] place-items-center rounded-[10px] px-3 py-2 text-center text-sm ${tone}`}
              >
                {mode === "round" && roundInst.id in tuned && zone !== "off" && !wrong ? "Afinado!" : message}
              </p>
              {mode === "round" && on && (
                <div
                  className="h-1.5 w-full max-w-[420px] overflow-hidden rounded-full bg-line"
                  role="progressbar"
                  aria-label="Tempo no verde"
                  aria-valuenow={Math.round(hold * 100)}
                >
                  <i
                    className="block h-full bg-ok transition-[width] duration-100"
                    style={{ width: `${hold * 100}%` }}
                  />
                </div>
              )}
            </section>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              {on && (
                <Button on onClick={stop}>
                  <MicIcon />
                  Desligar o microfone
                </Button>
              )}
              {on && (
                <span className="flex items-center gap-2 text-xs text-muted" title="Volume do microfone">
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
                    <i
                      className="block h-full bg-ok transition-[width] duration-100"
                      style={{ width: `${Math.round(pitch.level * 100)}%` }}
                    />
                  </span>
                </span>
              )}
              <Button on={refOn} onClick={toggleRef}>
                ♪ Lá de referência
              </Button>
              <div
                className="flex items-center gap-1.5 text-sm"
                role="group"
                aria-label="Lá de referência em Hz"
              >
                <Button aria-label="Baixar o Lá" onClick={() => setA4(a4 - 1)} disabled={a4 <= A4_MIN}>
                  −
                </Button>
                <span className="min-w-[88px] text-center tabular-nums" data-testid="tuner-a4">
                  Lá = {a4} Hz
                </span>
                <Button aria-label="Subir o Lá" onClick={() => setA4(a4 + 1)} disabled={a4 >= A4_MAX}>
                  +
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>Mostrador</span>
              <div
                role="group"
                aria-label="Mostrador"
                className="flex rounded-[10px] border border-line bg-surface-2 p-0.5"
              >
                {METER_STYLES.map(([s, label]) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={style === s}
                    onClick={() => setStyle(s)}
                    className={`rounded-[8px] px-3 py-1 text-[13px] ${
                      style === s ? "bg-surface font-semibold text-ink shadow-card" : "hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
        <ul className="mt-6 flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted">
          <li>Afine depois de aquecer o instrumento: frio, ele fica baixo.</li>
          <li>Na sala cheia, chegue o celular perto da campana e peça silêncio aos outros.</li>
          <li>O som do microfone não sai do seu aparelho. Fone Bluetooth atrapalha: use o alto-falante.</li>
        </ul>
      </main>
    </>
  );
}
