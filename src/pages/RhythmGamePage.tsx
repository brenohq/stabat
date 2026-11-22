import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { TopBar } from "../components/TopBar";
import { usePageView } from "../hooks/usePageView";
import { MetronomeIcon, MuteIcon, SoundIcon } from "../components/icons";
import { Button } from "../components/ui";
import { GameHud, Overlay, PrimaryButton, RoundEnd } from "../components/games/GameCard";
import { RhythmStaff, type StaffTap } from "../components/games/RhythmStaff";
import { STAFF_BAD, STAFF_OK, staffPoint } from "../components/games/rhythmStaffLayout";
import { fanfare, stopSfx, thud, woodblock } from "../audio/sfx";
import { RhythmClock } from "../audio/rhythmClock";
import { exposeDebug } from "../debug";
import { NOTE_COLORS } from "../lib/games/notes";
import { isMilestone, stars } from "../lib/games/scheduler";
import {
  BEATS_PER_MEASURE,
  CELLS,
  LEVEL_NAMES,
  MEASURES,
  SIXTEENTHS_PER_BEAT,
  cellById,
  fitsAt,
  type Cell,
  type RhythmLevel,
} from "../lib/games/rhythm/cells";
import { eventsOf, type Exercise, type PlacedCell } from "../lib/games/rhythm/measure";
import {
  calibrate,
  cellOutcomes,
  firstIssue,
  judge,
  onsetsOf,
  tendency,
  windowsFor,
  type Issue,
  type Judgement,
  type Windows,
} from "../lib/games/rhythm/judge";
import {
  canIntroduce,
  gradeExercise,
  introduce,
  levelOf,
  needsWarmup,
  nextExercise,
  normalize,
  ROUND_SIZE,
  WARMUP_CARDS,
  type RhythmMemory,
} from "../lib/games/rhythm/scheduler";
import { gameSound, rhythmBpm, rhythmGame, rhythmLatency } from "../lib/storage";

type Phase =
  | { kind: "welcome"; first: boolean; daysAway: number }
  | { kind: "intro"; cell: Cell; newLevel: RhythmLevel | null }
  | { kind: "count" }
  | { kind: "play" }
  | { kind: "result"; judgement: Judgement; issue: Issue }
  | { kind: "end" }
  | { kind: "calibrate"; step: "ready" | "running" | "done" | "few"; ms: number; used: number };

interface Game {
  mem: RhythmMemory;
  phase: Phase;
  results: boolean[];
  streak: number;
  roundBest: number;
  /** desvios (s) dos toques que casaram, na rodada: para a tendência no fim */
  offsets: number[];
  /** exercícios de aquecimento que faltam (só células firmes) */
  warmup: number;
  seq: number;
  exercise: Exercise | null;
  /** toques do exercício (s desde o 1 do primeiro compasso) */
  taps: number[];
  /** andamento do exercício (o músico pode mudar o seletor no meio) */
  bpm: number;
}

/** o que está tocando agora (fora do estado do React: o laço de quadros lê e escreve aqui) */
interface Run {
  t0: number;
  start: number;
  end: number;
  beat: number;
  bpm: number;
  onsets: number[];
  windows: Windows;
  lastBeat: number;
  cursor: boolean;
}

interface Fx {
  id: number;
  style: CSSProperties;
  text: string;
  plus?: boolean;
}

/** hora do relógio (ms), para "jogou pela última vez" */
const wallClock = () => Date.now();

const BPMS = [40, 50, 60, 70, 80, 90, 100, 110, 120];
const DAY = 24 * 60 * 60 * 1000;
const CALIBRATION_BPM = 80;
const MILESTONE_TEXT: Record<number, string> = {
  5: "Cinco seguidas!",
  10: "Dez seguidas! Que pulso!",
  20: "Vinte! Pronto para o ensaio",
  30: "Trinta! Ritmo de maestro",
};

function initialGame(): Game {
  const mem = normalize(rhythmGame.get());
  const now = Date.now();
  return {
    mem,
    phase: {
      kind: "welcome",
      first: mem.tick === 0,
      daysAway: needsWarmup(mem, now) ? Math.floor((now - mem.lastPlayed) / DAY) : 0,
    },
    results: [],
    streak: 0,
    roundBest: 0,
    offsets: [],
    warmup: 0,
    seq: 0,
    exercise: null,
    taps: [],
    bpm: 60,
  };
}

/** próximo passo: fim da rodada, célula nova (apresentação) ou um exercício novo */
function nextCard(g: Game): Game {
  if (g.results.length >= ROUND_SIZE) return { ...g, phase: { kind: "end" } };
  if (canIntroduce(g.mem)) {
    const before = levelOf(g.mem);
    const { memory, cell } = introduce(g.mem);
    return {
      ...g,
      mem: memory,
      phase: { kind: "intro", cell, newLevel: cell.level > before ? cell.level : null },
    };
  }
  const exercise = nextExercise(g.mem, { prev: g.exercise ?? undefined, warmup: g.warmup > 0 });
  return {
    ...g,
    exercise,
    taps: [],
    warmup: Math.max(0, g.warmup - 1),
    seq: g.seq + 1,
    phase: { kind: "count" },
  };
}

const newRound = (g: Game, warmup: number): Game =>
  nextCard({ ...g, results: [], roundBest: 0, offsets: [], warmup });

/** um compasso só com a célula (repetida; o que sobra, semínimas), para a apresentação */
function introExercise(cell: Cell): Exercise {
  const q = cellById("q");
  const cells: PlacedCell[] = [];
  let beat = 0;
  while (beat < BEATS_PER_MEASURE) {
    const c = fitsAt(cell, beat) ? cell : q;
    cells.push({ cell: c, on: beat * SIXTEENTHS_PER_BEAT });
    beat += c.durs.reduce((a, d) => a + Math.abs(d), 0) / SIXTEENTHS_PER_BEAT;
  }
  return { cells, events: eventsOf(cells) };
}

function issueText(issue: Issue): string {
  if (issue.kind === "none") return "";
  const where = `compasso ${issue.measure}, tempo ${issue.beat}`;
  if (issue.kind === "miss") return `Faltou a ${issue.note}ª nota (${where}).`;
  return issue.rest ? `Toque na pausa (${where}).` : `Toque a mais (${where}).`;
}

export function RhythmGamePage() {
  usePageView("Bate o ritmo · stabat");
  const [game, setGame] = useState(initialGame);
  const [sound, setSound] = useState(gameSound.get);
  const [bpm, setBpm] = useState(() => (BPMS.includes(rhythmBpm.get()) ? rhythmBpm.get() : 60));
  const [metronome, setMetronome] = useState(true);
  const [latency, setLatency] = useState(rhythmLatency.get);
  const [waitHint, setWaitHint] = useState(false);
  const [fx, setFx] = useState<Fx[]>([]);
  const [banner, setBanner] = useState<{ id: number; text: string } | null>(null);

  const ref = useRef(game);
  const soundRef = useRef(sound);
  const bpmRef = useRef(bpm);
  const metronomeRef = useRef(metronome);
  const clock = useRef<RhythmClock>(null);
  clock.current ??= new RhythmClock();
  const run = useRef<Run | null>(null);
  const raf = useRef(0);
  const timers = useRef<number[]>([]);
  const fxId = useRef(0);
  const calib = useRef<{ clicks: number[]; taps: number[] }>({ clicks: [], taps: [] });
  const countEl = useRef<HTMLDivElement>(null);
  const beatsEl = useRef<HTMLDivElement>(null);
  const cursorEl = useRef<SVGLineElement>(null);
  const padEl = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    clock.current!.calibrationMs = latency ?? 0;
  }, [latency]);

  useEffect(() => {
    const list = timers.current;
    const c = clock.current;
    return () => {
      list.forEach(clearTimeout);
      cancelAnimationFrame(raf.current);
      c?.stop();
      stopSfx();
    };
  }, []);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  /** troca de estado + o que acontece ao entrar na fase nova (salvar, sons, começar o relógio) */
  const commit = (nextGame: Game) => {
    let next = nextGame;
    if (next.phase.kind === "count" && next.phase !== ref.current.phase)
      next = { ...next, bpm: bpmRef.current };
    if (next.mem !== ref.current.mem) rhythmGame.set(next.mem);
    const entering = next.phase !== ref.current.phase ? next.phase : null;
    ref.current = next;
    setGame(next);
    if (!entering) return;
    if (entering.kind === "count") startRun(next);
    if (entering.kind === "intro" && entering.newLevel && soundRef.current) fanfare();
    if (entering.kind === "end" && next.results.filter(Boolean).length >= 9 && soundRef.current) fanfare();
  };
  const advance = () => commit(nextCard(ref.current));

  const start = () => {
    const ph = ref.current.phase;
    commit(newRound(ref.current, ph.kind === "welcome" && ph.daysAway > 0 ? WARMUP_CARDS : 0));
  };

  /** luzes dos tempos e número da contagem, direto no DOM */
  const showBeat = (inBar: number | null, count: number | null) => {
    beatsEl.current?.querySelectorAll("i").forEach((el, i) => {
      el.toggleAttribute("data-on", i === inBar);
    });
    const c = countEl.current;
    if (!c) return;
    c.classList.remove("g-count");
    if (count === null) return;
    c.textContent = String(count);
    void c.offsetWidth; // reinicia a animação
    c.classList.add("g-count");
  };

  const startRun = (g: Game) => {
    const ck = clock.current!;
    if (!ck.ctx || !g.exercise) return;
    ck.stop();
    const b = g.bpm;
    const beat = 60 / b;
    const t0 = ck.now() + 0.35;
    const startAt = t0 + BEATS_PER_MEASURE * beat;
    const beats = MEASURES * BEATS_PER_MEASURE;
    const clicks = Array.from({ length: BEATS_PER_MEASURE }, (_, i) => ({
      at: t0 + i * beat,
      accent: i === 0,
    }));
    if (metronomeRef.current)
      for (let i = 0; i < beats; i++)
        clicks.push({ at: startAt + i * beat, accent: i % BEATS_PER_MEASURE === 0 });
    ck.clicks(clicks);
    const onsets = onsetsOf(g.exercise, b);
    run.current = {
      t0,
      start: startAt,
      end: startAt + beats * beat,
      beat,
      bpm: b,
      onsets,
      windows: windowsFor(onsets),
      lastBeat: -1,
      cursor: levelOf(g.mem) === 1,
    };
    setWaitHint(false);
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(loop);
  };

  const loop = () => {
    const r = run.current;
    if (!r) return;
    const now = clock.current!.heardNow();
    if (now >= r.t0) {
      const b = Math.floor((now - r.t0) / r.beat);
      if (b !== r.lastBeat) {
        r.lastBeat = b;
        showBeat(b % BEATS_PER_MEASURE, b < BEATS_PER_MEASURE ? BEATS_PER_MEASURE - b : null);
      }
      if (b >= BEATS_PER_MEASURE && ref.current.phase.kind === "count") {
        setWaitHint(false);
        commit({ ...ref.current, phase: { kind: "play" } });
      }
    }
    const cur = cursorEl.current;
    if (cur) {
      const on = r.cursor && now >= r.start && now < r.end;
      cur.setAttribute("opacity", on ? "0.8" : "0");
      if (on) {
        const p = staffPoint(((now - r.start) / r.beat) * SIXTEENTHS_PER_BEAT, MEASURES);
        cur.setAttribute("x1", String(p.x));
        cur.setAttribute("x2", String(p.x));
        cur.setAttribute("y1", String(p.top));
        cur.setAttribute("y2", String(p.bottom));
      }
    }
    if (now >= r.end + r.windows.good + 0.05) {
      finish();
      return;
    }
    raf.current = requestAnimationFrame(loop);
  };

  const celebrate = () => {
    const glyphs = ["♪", "♫", "♩", "♬"] as const;
    const items: Fx[] = Array.from({ length: 7 }, (_, i) => {
      const ang = ((-160 + i * 30) * Math.PI) / 180;
      const d = 60 + Math.random() * 40;
      return {
        id: ++fxId.current,
        text: glyphs[i % 4]!,
        style: {
          left: "50%",
          top: "45%",
          color: NOTE_COLORS[i % 7],
          "--dx": `${Math.cos(ang) * d * 1.6}px`,
          "--dy": `${Math.sin(ang) * d - 10}px`,
          "--r": `${Math.random() * 60 - 30}deg`,
        } as CSSProperties,
      };
    });
    items.push({
      id: ++fxId.current,
      text: "+1",
      style: { left: "calc(50% + 30px)", top: "40%" },
      plus: true,
    });
    setFx((f) => [...f, ...items]);
    const ids = new Set(items.map((x) => x.id));
    later(900, () => setFx((f) => f.filter((x) => !ids.has(x.id))));
  };

  /** fim do exercício: julga, guarda, comemora ou mostra o erro */
  const finish = () => {
    const r = run.current;
    const g = ref.current;
    if (!r || !g.exercise || (g.phase.kind !== "play" && g.phase.kind !== "count")) return;
    run.current = null;
    cancelAnimationFrame(raf.current);
    clock.current!.stop();
    showBeat(null, null);
    cursorEl.current?.setAttribute("opacity", "0");
    const j = judge(r.onsets, g.taps, r.windows);
    const outcomes = cellOutcomes(g.exercise, j, g.taps, r.bpm);
    const graded = gradeExercise(g.mem, g.exercise, outcomes, wallClock());
    const streak = j.ok ? g.streak + 1 : 0;
    commit({
      ...g,
      mem: { ...graded, best: Math.max(graded.best, streak) },
      streak,
      roundBest: Math.max(g.roundBest, streak),
      results: [...g.results, j.ok],
      offsets: [...g.offsets, ...j.notes.filter((n) => n.tap >= 0).map((n) => n.offset)],
      phase: { kind: "result", judgement: j, issue: firstIssue(g.exercise, j, g.taps, r.bpm) },
    });
    if (j.ok) {
      celebrate();
      if (isMilestone(streak)) {
        setBanner({ id: ++fxId.current, text: MILESTONE_TEXT[streak] ?? `${streak} seguidas!` });
        if (soundRef.current) fanfare();
      }
      later(isMilestone(streak) ? 1700 : 1400, advance);
    } else {
      if (soundRef.current) thud();
      try {
        navigator.vibrate?.(60);
      } catch {
        /* sem vibração */
      }
      later(2800, advance);
    }
  };

  /** registra um toque (s desde o 1 do primeiro compasso) */
  const addTap = (rel: number) => {
    const r = run.current;
    const ph = ref.current.phase.kind;
    if (!r || (ph !== "count" && ph !== "play")) return;
    if (rel < -r.windows.good) {
      setWaitHint(true);
      return;
    }
    if (rel > r.end - r.start + r.windows.good) return;
    commit({ ...ref.current, taps: [...ref.current.taps, rel] });
  };

  const pressPad = () => {
    const p = padEl.current;
    if (!p) return;
    p.classList.add("g-pad-down");
    later(90, () => p.classList.remove("g-pad-down"));
  };

  const tap = (timeStamp?: number) => {
    const ph = ref.current.phase;
    if (ph.kind === "calibrate") {
      if (ph.step !== "running") return;
      if (soundRef.current) woodblock();
      pressPad();
      // sem o ajuste atual: medimos o atraso do zero
      calib.current.taps.push(clock.current!.tapTime(timeStamp) + clock.current!.calibrationMs / 1000);
      return;
    }
    const r = run.current;
    if (!r || (ph.kind !== "count" && ph.kind !== "play")) return;
    if (soundRef.current) woodblock();
    pressPad();
    addTap(clock.current!.tapTime(timeStamp) - r.start);
  };

  // teclado (barra de espaço) e gancho de testes: sempre com as funções da última renderização
  const tapRef = useRef(tap);
  const addTapRef = useRef(addTap);
  const finishRef = useRef(finish);
  useEffect(() => {
    tapRef.current = tap;
    addTapRef.current = addTap;
    finishRef.current = finish;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = ref.current.phase;
      if (k.kind === "count" || k.kind === "play" || (k.kind === "calibrate" && k.step === "running")) {
        e.preventDefault();
        tapRef.current(e.timeStamp);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- ajuste do atraso ---------- */
  const openCalibration = () => {
    run.current = null;
    cancelAnimationFrame(raf.current);
    clock.current!.stop();
    timers.current.forEach(clearTimeout);
    timers.current = [];
    showBeat(null, null);
    commit({ ...ref.current, phase: { kind: "calibrate", step: "ready", ms: 0, used: 0 } });
  };
  const runCalibration = () => {
    const ck = clock.current!;
    if (!ck.ctx) return;
    const beat = 60 / CALIBRATION_BPM;
    const t0 = ck.now() + 0.4;
    const clicks = Array.from({ length: 12 }, (_, i) => ({ at: t0 + i * beat, accent: i % 4 === 0 }));
    ck.clicks(clicks);
    calib.current = { clicks: clicks.slice(4).map((c) => c.at), taps: [] };
    commit({ ...ref.current, phase: { kind: "calibrate", step: "running", ms: 0, used: 0 } });
    later((0.4 + 12 * beat + 0.4) * 1000, () => {
      const res = calibrate(calib.current.taps, calib.current.clicks);
      const ok = res.used >= 5;
      if (ok) {
        const ms = Math.round(res.offsetMs);
        rhythmLatency.set(ms);
        setLatency(ms);
      }
      commit({
        ...ref.current,
        phase: { kind: "calibrate", step: ok ? "done" : "few", ms: Math.round(res.offsetMs), used: res.used },
      });
    });
  };
  const leaveCalibration = () => commit({ ...initialGame(), mem: ref.current.mem });

  /* ---------- controles ---------- */
  const toggleSound = () => {
    const on = !soundRef.current;
    soundRef.current = on;
    gameSound.set(on);
    setSound(on);
  };
  const changeBpm = (dir: -1 | 1) => {
    const at = BPMS.indexOf(bpmRef.current);
    const next = BPMS[Math.max(0, Math.min(BPMS.length - 1, at + dir))]!;
    bpmRef.current = next;
    rhythmBpm.set(next);
    setBpm(next);
  };
  const toggleMetronome = () => {
    metronomeRef.current = !metronomeRef.current;
    setMetronome(metronomeRef.current);
  };

  useEffect(() => {
    exposeDebug("game", {
      state: () => {
        const g = ref.current;
        return {
          phase: g.phase.kind,
          seq: g.seq,
          answered: g.results.length,
          streak: g.streak,
          introduced: g.mem.introduced,
          level: levelOf(g.mem),
          cells: g.exercise?.cells.map((p) => p.cell.id) ?? [],
          onsets: run.current?.onsets ?? null,
          taps: g.taps,
          bpm: bpmRef.current,
        };
      },
      /** toque no tempo exato (s desde o 1 do primeiro compasso), sem depender do relógio real */
      tapAt: (sec: number) => addTapRef.current(sec),
      /** termina o exercício agora (julga os toques que houver) */
      finish: () => finishRef.current(),
    });
    return () => exposeDebug("game", null);
  }, []);

  const { phase, mem } = game;
  const level = levelOf(mem);
  const ex = game.exercise;
  const result = phase.kind === "result" ? phase : null;
  const tapPos = (t: number) => t / (60 / game.bpm / SIXTEENTHS_PER_BEAT);
  const taps: StaffTap[] = game.taps.map((t, i) => ({
    pos: tapPos(t),
    state: result ? (result.judgement.extras.includes(i) ? "bad" : "ok") : "live",
  }));
  const colors = result?.judgement.notes.map((n) => (n.grade === "miss" ? STAFF_BAD : STAFF_OK));
  const marks = result?.judgement.notes.map((n) =>
    n.grade === "good" ? (n.offset < 0 ? "cedo" : "tarde") : undefined,
  );
  const shown = ex ?? introExercise(CELLS[0]!);
  const live = phase.kind === "count" || phase.kind === "play";

  let hint: ReactNode = null;
  if (phase.kind === "count")
    hint = waitHint ? (
      <span>Espere a contagem terminar: toque depois do 1.</span>
    ) : (
      <span className="text-muted">Prepare-se…</span>
    );
  if (phase.kind === "play") hint = <span className="text-muted">Toque no ataque de cada nota</span>;
  if (result) {
    const j = result.judgement;
    if (j.ok) {
      const goods = j.notes.filter((n) => n.grade === "good");
      const early = goods.filter((n) => n.offset < 0).length;
      hint =
        goods.length === 0 ? (
          <b className="font-display text-lg text-ok">No tempo!</b>
        ) : (
          <span>
            <b className="font-display text-lg text-ok">Certo!</b>{" "}
            {goods.length === 1 ? "Uma nota veio" : `${goods.length} notas vieram`} um pouco{" "}
            {early >= goods.length / 2 ? "cedo" : "tarde"}.
          </span>
        );
    } else if (game.taps.length === 0) {
      hint = (
        <span>
          <b className="font-display text-lg text-bad">Nenhum toque.</b> Toque depois da contagem.
        </span>
      );
    } else {
      hint = (
        <span>
          <b className="font-display text-lg text-bad">Quase.</b> {issueText(result.issue)}
        </span>
      );
    }
  }

  const tip = (() => {
    const t = tendency(game.offsets);
    if (t === "early") return "Você tende a correr: espere o clique.";
    if (t === "late") return "Você tende a atrasar: toque junto com o clique.";
    return "Nem correndo, nem atrasando: bom pulso.";
  })();

  return (
    <>
      <TopBar crumbs={<span>Jogos / Bate o ritmo</span>} />
      <main className="mx-auto max-w-[680px] px-3 pt-4 pb-10 sm:px-4 sm:pt-8">
        <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
          <h1 className="text-[22px] sm:text-[28px]">Bate o ritmo</h1>
          <span className="text-[13px] text-muted">Toque no ataque de cada nota</span>
        </div>
        <div className="relative overflow-hidden rounded-[20px] border border-line bg-surface p-3 shadow-card sm:p-4">
          <GameHud
            level={`Nível ${level} · ${LEVEL_NAMES[level]}`}
            results={game.results}
            total={ROUND_SIZE}
            active={live}
            streak={game.streak}
            flashKey={banner?.id}
            unit="exercícios"
          />

          <div
            className="relative mt-3 touch-manipulation rounded-[14px] border border-line bg-paper select-none"
            data-testid="game-stage"
            onPointerDown={(e) => {
              if (!live) return;
              e.preventDefault();
              tap(e.timeStamp);
            }}
          >
            <div className="flex items-center justify-between gap-2 px-3.5 pt-2.5 text-xs text-[#6b665a]">
              <div ref={beatsEl} className="flex items-center gap-2" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <i
                    key={i}
                    data-first={i === 0 ? "" : undefined}
                    className="g-beat size-3 rounded-full border-2 border-[#d9d1c2]"
                  />
                ))}
              </div>
              <span
                className={`text-[11px] font-bold tracking-wider uppercase ${
                  phase.kind === "play" ? "text-[#a8761c]" : ""
                }`}
                data-testid="rhythm-phase"
              >
                {phase.kind === "count" ? "Contagem" : phase.kind === "play" ? "Sua vez!" : " "}
              </span>
            </div>
            <RhythmStaff
              key={game.seq}
              events={shown.events}
              measures={MEASURES}
              ruler
              offbeats={level >= 3}
              colors={colors}
              marks={marks}
              taps={taps}
              cursorRef={cursorEl}
              label={`Dois compassos 4/4: ${shown.cells.map((p) => p.cell.name.toLowerCase()).join(", ")}`}
            />
            <div
              ref={countEl}
              aria-hidden
              className="pointer-events-none absolute inset-0 grid place-items-center font-display text-[88px] font-bold text-[#1f2a44] opacity-0"
              data-testid="count-in"
            />
            {fx.map((f) => (
              <span
                key={f.id}
                aria-hidden
                style={f.style}
                className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 ${
                  f.plus ? "g-plus font-display text-[22px] font-bold text-ok" : "g-particle text-xl"
                }`}
              >
                {f.text}
              </span>
            ))}
            {banner && (
              <div
                key={banner.id}
                className="g-banner pointer-events-none absolute top-4 left-1/2 rounded-full border-2 border-[#e0aa45] bg-navy px-4 py-1.5 font-display text-lg font-semibold whitespace-nowrap text-[#f3eee4] opacity-0 shadow-card"
              >
                {banner.text}
              </div>
            )}
          </div>

          <p
            className="flex min-h-12 items-center justify-center px-2 text-center text-[15px] leading-snug"
            aria-live="polite"
            data-testid="game-hint"
          >
            {hint}
          </p>

          <button
            ref={padEl}
            type="button"
            aria-label="Tocar"
            data-testid="rhythm-pad"
            onPointerDown={(e) => {
              e.preventDefault();
              tap(e.timeStamp);
            }}
            className={`grid min-h-24 w-full cursor-pointer touch-manipulation place-items-center content-center gap-0.5 rounded-2xl border-2 border-b-[7px] bg-surface-2 transition-[transform,border-color] duration-75 select-none [-webkit-tap-highlight-color:transparent] ${
              phase.kind === "play" ? "border-accent" : "border-line"
            }`}
            style={{ borderBottomColor: "var(--accent)" }}
          >
            <span className="font-display text-[26px] leading-tight font-bold">Toque</span>
            <span className="text-xs font-semibold text-muted">
              aqui ou na pauta<span className="hidden sm:inline"> · barra de espaço</span>
            </span>
          </button>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[12.5px] text-muted">
            <TempoControl bpm={bpm} onChange={changeBpm} />
            <div className="flex items-center gap-1">
              <Button on={metronome} onClick={toggleMetronome} aria-label="Metrônomo">
                <MetronomeIcon />
                <span className="max-sm:hidden">Metrônomo</span>
              </Button>
              <button
                type="button"
                onClick={toggleSound}
                aria-pressed={sound}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 transition hover:bg-surface-2 [&_svg]:size-[18px]"
              >
                {sound ? <SoundIcon /> : <MuteIcon />}
                {sound ? "Som ligado" : "Sem som"}
              </button>
            </div>
            <button
              type="button"
              onClick={openCalibration}
              className="w-full rounded-lg px-2 py-1 text-left transition hover:bg-surface-2 sm:w-auto"
              data-testid="calibrate-open"
            >
              Ajustar atraso do som
              {latency !== null && ` (${latency >= 0 ? "+" : ""}${latency} ms)`}
            </button>
          </div>

          {phase.kind === "welcome" && (
            <Overlay>
              <span className="text-xs font-semibold tracking-wider text-accent uppercase">
                {phase.first ? "Jogo de ritmo" : "Bem-vindo de volta"}
              </span>
              <h2 className="text-[28px]">{phase.first ? "Bate o ritmo" : `Nível ${level}`}</h2>
              {phase.first ? (
                <p className="text-muted">
                  Vão aparecer dois compassos. O metrônomo conta 4, 3, 2, 1; depois toque no ataque de cada
                  nota, no tempo certo. Quanto mais você acerta, mais ritmos aparecem.
                </p>
              ) : (
                <p className="text-muted">
                  {LEVEL_NAMES[level]} · {mem.introduced} de {CELLS.length} ritmos · melhor sequência{" "}
                  {mem.best}
                  {phase.daysAway > 0 && (
                    <>
                      <br />
                      Faz {phase.daysAway} dias! Vamos aquecer com ritmos que você já conhece.
                    </>
                  )}
                </p>
              )}
              <TempoControl bpm={bpm} onChange={changeBpm} />
              <PrimaryButton onClick={start}>Começar</PrimaryButton>
              <button type="button" onClick={openCalibration} className="text-[13px] text-muted underline">
                {latency === null
                  ? "Antes, ajustar o atraso do som (fone Bluetooth atrasa)"
                  : `Ajustar o atraso do som (${latency >= 0 ? "+" : ""}${latency} ms)`}
              </button>
            </Overlay>
          )}

          {phase.kind === "intro" && (
            <Overlay>
              <span className="text-xs font-semibold tracking-wider text-accent uppercase">
                {phase.newLevel ? `Nível ${phase.newLevel} desbloqueado` : "Ritmo novo"}
              </span>
              <h2 className="text-[26px]">{phase.cell.name}</h2>
              <div className="w-full max-w-[340px] rounded-[10px] border border-line bg-paper">
                <RhythmStaff
                  events={introExercise(phase.cell).events}
                  measures={1}
                  label={`${phase.cell.name} na pauta`}
                />
              </div>
              <p className="text-muted">{phase.cell.how}</p>
              <PrimaryButton onClick={advance}>Vamos lá</PrimaryButton>
            </Overlay>
          )}

          {phase.kind === "calibrate" && (
            <Overlay>
              <span className="text-xs font-semibold tracking-wider text-accent uppercase">
                Ajustar atraso do som
              </span>
              {phase.step === "ready" && (
                <>
                  <h2 className="text-[26px]">Toque junto com os cliques</h2>
                  <p className="text-muted">
                    Vão soar 4 cliques de contagem e depois 8. Toque em cada um dos 8, no botão abaixo ou na
                    barra de espaço.
                  </p>
                  <PrimaryButton onClick={runCalibration}>Começar</PrimaryButton>
                </>
              )}
              {phase.step === "running" && (
                <>
                  <h2 className="text-[26px]">Toque em cada clique</h2>
                  <button
                    type="button"
                    autoFocus
                    onPointerDown={(e) => {
                      e.preventDefault();
                      tap(e.timeStamp);
                    }}
                    className="grid min-h-24 w-full max-w-[300px] touch-manipulation place-items-center rounded-2xl border-2 border-b-[7px] border-line bg-surface-2 font-display text-[26px] font-bold select-none"
                    style={{ borderBottomColor: "var(--accent)" }}
                    data-testid="calibrate-pad"
                  >
                    Toque
                  </button>
                </>
              )}
              {phase.step === "done" && (
                <>
                  <h2 className="text-[30px] tabular-nums">
                    {phase.ms >= 0 ? "+" : ""}
                    {phase.ms} ms
                  </h2>
                  <p className="text-muted">
                    {Math.abs(phase.ms) > 80
                      ? "É bastante atraso. Está com fone Bluetooth? Prefira um fone com fio ou o alto-falante."
                      : "Pronto: o jogo vai descontar isso dos seus toques."}
                  </p>
                  <PrimaryButton onClick={leaveCalibration}>Voltar ao jogo</PrimaryButton>
                </>
              )}
              {phase.step === "few" && (
                <>
                  <h2 className="text-[26px]">Poucos toques</h2>
                  <p className="text-muted">
                    Só {phase.used} toques caíram perto dos cliques. Tente de novo, tocando em cada clique.
                  </p>
                  <PrimaryButton onClick={runCalibration}>Tentar de novo</PrimaryButton>
                  <button
                    type="button"
                    onClick={leaveCalibration}
                    className="text-[13px] text-muted underline"
                  >
                    Voltar ao jogo
                  </button>
                </>
              )}
            </Overlay>
          )}

          {phase.kind === "end" && (
            <RoundEnd
              stars={stars(game.results.filter(Boolean).length)}
              correct={game.results.filter(Boolean).length}
              total={game.results.length}
              best={game.roundBest}
              unit="exercícios certos"
              tip={tip}
              onAgain={() => commit(newRound(ref.current, 0))}
            >
              <TempoControl bpm={bpm} onChange={changeBpm} />
            </RoundEnd>
          )}
        </div>
      </main>
    </>
  );
}

/** andamento: − 60 bpm + */
function TempoControl({ bpm, onChange }: { bpm: number; onChange: (dir: -1 | 1) => void }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Andamento">
      <Button aria-label="Mais devagar" disabled={bpm === BPMS[0]} onClick={() => onChange(-1)}>
        −
      </Button>
      <span className="w-[64px] text-center text-sm text-ink tabular-nums" data-testid="rhythm-bpm">
        {bpm} bpm
      </span>
      <Button aria-label="Mais rápido" disabled={bpm === BPMS[BPMS.length - 1]} onClick={() => onChange(1)}>
        +
      </Button>
    </div>
  );
}
