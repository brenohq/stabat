import { Link } from "react-router";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { TopBar } from "../components/TopBar";
import { usePageView } from "../hooks/usePageView";
import { NoteStaff } from "../components/games/NoteStaff";
import { staffGeometry } from "../components/games/staffGeometry";
import { MuteIcon, SoundIcon } from "../components/icons";
import { GameHud, LevelStepper, Overlay, PrimaryButton, RoundEnd } from "../components/games/GameCard";
import { fanfare, stopSfx, thud, tone } from "../audio/sfx";
import { exposeDebug } from "../debug";
import {
  LETTERS,
  LEVEL_NAMES,
  NAMES,
  NOTES,
  NOTE_COLORS,
  type GameNote,
  type Level,
} from "../lib/games/notes";
import {
  canIntroduce,
  startAtLevel,
  grade,
  introduce,
  isMilestone,
  levelOf,
  needsWarmup,
  normalize,
  pickNext,
  ROUND_SIZE,
  stars,
  topConfusion,
  WARMUP_CARDS,
  type Memory,
} from "../lib/games/scheduler";
import { gameSound, noteGame } from "../lib/storage";

type Phase =
  | { kind: "welcome"; first: boolean; daysAway: number }
  | { kind: "ask"; note: GameNote; shownAt: number }
  | { kind: "intro"; note: GameNote; tapped: boolean }
  | { kind: "ok"; note: GameNote; answer: number }
  | { kind: "bad"; note: GameNote; answer: number }
  /** chosen = o músico escolheu o nível (não foi liberado agora) */
  | { kind: "level"; level: Level; note: GameNote; chosen?: boolean }
  | { kind: "end" };

interface Game {
  mem: Memory;
  phase: Phase;
  results: boolean[];
  streak: number;
  roundBest: number;
  roundConfusions: Record<string, number>;
  /** cartas de aquecimento que faltam (só notas conhecidas) */
  warmup: number;
  /** muda a cada carta: refaz a animação de entrada da nota */
  seq: number;
  prevId?: string;
}

interface Fx {
  id: number;
  kind: "particle" | "plus";
  style: CSSProperties;
  text: string;
}

/** pauta só com a altura das notas já apresentadas: cresce quando chega um nível novo */
function geometryFor(introduced: number) {
  const steps = NOTES.slice(0, introduced).map((n) => n.step);
  return staffGeometry({
    top: Math.max(10, ...steps.map((s) => s + 2)),
    bottom: Math.min(-3, ...steps.map((s) => s - 2)),
  });
}
const NOTE_X = 214;
const DAY = 24 * 60 * 60 * 1000;
const MILESTONE_TEXT: Record<number, string> = {
  5: "Cinco seguidas!",
  10: "Dez seguidas! Que leitura!",
  20: "Vinte! Pronto para o ensaio",
  30: "Trinta! Leitura de maestro",
};

function initialGame(): Game {
  const mem = normalize(noteGame.get());
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
    roundConfusions: {},
    warmup: 0,
    seq: 0,
  };
}

/** próxima carta: fim da rodada, nota nova (com tela de nível novo) ou sorteio */
function nextCard(g: Game): Game {
  if (g.results.length >= ROUND_SIZE) return { ...g, phase: { kind: "end" } };
  if (canIntroduce(g.mem)) {
    const before = levelOf(g.mem);
    const { memory, note } = introduce(g.mem);
    const base = { ...g, mem: memory, seq: g.seq + 1, prevId: note.id };
    return note.level > before
      ? { ...base, phase: { kind: "level", level: note.level, note } }
      : { ...base, phase: { kind: "intro", note, tapped: false } };
  }
  const note = pickNext(g.mem, { prevId: g.prevId, warmup: g.warmup > 0 });
  return {
    ...g,
    warmup: Math.max(0, g.warmup - 1),
    prevId: note.id,
    seq: g.seq + 1,
    phase: { kind: "ask", note, shownAt: performance.now() },
  };
}

const newRound = (g: Game, warmup: number): Game =>
  nextCard({ ...g, results: [], roundBest: 0, roundConfusions: {}, warmup });

export function NoteGamePage() {
  usePageView("Que nota é essa? · stabat");
  const [game, setGame] = useState(initialGame);
  const [sound, setSound] = useState(gameSound.get);
  const [fx, setFx] = useState<Fx[]>([]);
  const [banner, setBanner] = useState<{ id: number; text: string } | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  /** nível escolhido no seletor (null = o atual) */
  const [pick, setPick] = useState<Level | null>(null);
  const ref = useRef(game);
  const soundRef = useRef(sound);
  const timers = useRef<number[]>([]);
  const fxId = useRef(0);

  useEffect(() => {
    const list = timers.current;
    return () => {
      list.forEach(clearTimeout);
      stopSfx();
    };
  }, []);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const play = (freq: number) => soundRef.current && tone(freq);
  const playFanfare = () => soundRef.current && fanfare();

  /** troca de estado + o que acontece ao entrar na fase nova (salvar, sons) */
  const commit = (next: Game) => {
    if (next.mem !== ref.current.mem) noteGame.set(next.mem);
    const entering = next.phase !== ref.current.phase ? next.phase : null;
    ref.current = next;
    setGame(next);
    if (!entering) return;
    if (entering.kind === "intro") later(150, () => play(entering.note.freq));
    if (entering.kind === "level") playFanfare();
    if (entering.kind === "end" && next.results.filter(Boolean).length >= 9) playFanfare();
  };
  const advance = () => commit(nextCard(ref.current));

  /** começa a rodada no nível escolhido; outro nível = recomeça no começo dele */
  const start = () => {
    const g = ref.current;
    const target = pick ?? levelOf(g.mem);
    setPick(null);
    if (target === levelOf(g.mem)) {
      commit(newRound(g, g.phase.kind === "welcome" && g.phase.daysAway > 0 ? WARMUP_CARDS : 0));
      return;
    }
    const g0: Game = {
      ...g,
      mem: startAtLevel(g.mem, target),
      results: [],
      roundBest: 0,
      roundConfusions: {},
      warmup: 0,
    };
    if (target === 1) {
      commit(nextCard(g0));
      return;
    }
    const { memory, note } = introduce(g0.mem);
    commit({
      ...g0,
      mem: memory,
      seq: g0.seq + 1,
      prevId: note.id,
      phase: { kind: "level", level: target, note, chosen: true },
    });
  };

  /** o selo do nível: para a rodada e abre a escolha de nível */
  const chooseLevel = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPick(null);
    commit({ ...ref.current, phase: { kind: "welcome", first: false, daysAway: 0 } });
  };

  const celebrate = (note: GameNote) => {
    const geo = geometryFor(ref.current.mem.introduced);
    const left = (NOTE_X / geo.width) * 100;
    const top = (geo.y(note.step) / geo.height) * 100;
    const glyphs = ["♪", "♫", "♩", "♬"] as const;
    const items: Fx[] = Array.from({ length: 7 }, (_, i) => {
      const ang = ((-160 + i * 30) * Math.PI) / 180;
      const d = 50 + Math.random() * 30;
      return {
        id: ++fxId.current,
        kind: "particle",
        text: glyphs[i % 4]!,
        style: {
          left: `${left}%`,
          top: `${top}%`,
          color: NOTE_COLORS[(note.idx + i) % 7],
          "--dx": `${Math.cos(ang) * d}px`,
          "--dy": `${Math.sin(ang) * d - 10}px`,
          "--r": `${Math.random() * 60 - 30}deg`,
        } as CSSProperties,
      };
    });
    items.push({
      id: ++fxId.current,
      kind: "plus",
      text: "+1",
      style: { left: `calc(${left}% + 22px)`, top: `${top}%` },
    });
    setFx((f) => [...f, ...items]);
    const ids = new Set(items.map((x) => x.id));
    later(900, () => setFx((f) => f.filter((x) => !ids.has(x.id))));
  };

  const answer = (i: number) => {
    const g = ref.current;
    const ph = g.phase;
    if (ph.kind === "intro") {
      if (ph.tapped) return;
      if (i !== ph.note.idx) {
        setShake(i);
        later(420, () => setShake(null));
        return;
      }
      commit({ ...g, phase: { ...ph, tapped: true } });
      play(ph.note.freq);
      later(700, advance);
      return;
    }
    if (ph.kind !== "ask") return;
    const note = ph.note;
    const ok = i === note.idx;
    const streak = ok ? g.streak + 1 : 0;
    const graded = grade(g.mem, note, i, performance.now() - ph.shownAt, Date.now());
    const k = `${note.idx}>${i}`;
    commit({
      ...g,
      mem: { ...graded, best: Math.max(graded.best, streak) },
      streak,
      roundBest: Math.max(g.roundBest, streak),
      results: [...g.results, ok],
      roundConfusions: ok
        ? g.roundConfusions
        : { ...g.roundConfusions, [k]: (g.roundConfusions[k] ?? 0) + 1 },
      phase: { kind: ok ? "ok" : "bad", note, answer: i },
    });
    if (ok) {
      play(note.freq);
      celebrate(note);
      if (isMilestone(streak)) {
        setBanner({ id: ++fxId.current, text: MILESTONE_TEXT[streak] ?? `${streak} seguidas!` });
        playFanfare();
      }
      later(isMilestone(streak) ? 1200 : 650, advance);
    } else {
      if (soundRef.current) thud();
      later(260, () => play(note.freq));
      try {
        navigator.vibrate?.(60);
      } catch {
        /* sem vibração */
      }
      later(2000, advance);
    }
  };

  const toggleSound = () => {
    const on = !soundRef.current;
    soundRef.current = on;
    gameSound.set(on);
    setSound(on);
  };

  // teclado: 1–7 ou C D E F G A B
  const answerRef = useRef(answer);
  useEffect(() => {
    answerRef.current = answer;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      let i = /^[1-7]$/.test(e.key) ? Number(e.key) - 1 : -1;
      if (i < 0 && e.key.length === 1) i = LETTERS.indexOf(e.key.toUpperCase() as (typeof LETTERS)[number]);
      if (i >= 0) answerRef.current(i);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    exposeDebug("game", {
      state: () => {
        const g = ref.current;
        const note = "note" in g.phase ? g.phase.note : null;
        return {
          phase: g.phase.kind,
          note: note?.id ?? null,
          idx: note?.idx ?? null,
          answered: g.results.length,
          streak: g.streak,
          introduced: g.mem.introduced,
          seq: g.seq,
        };
      },
    });
    return () => exposeDebug("game", null);
  }, []);

  const { phase, mem } = game;
  const level = levelOf(mem);
  const geo = geometryFor(mem.introduced);
  const note = "note" in phase && phase.kind !== "level" ? phase.note : null;
  const colored = note && (phase.kind === "ok" || phase.kind === "intro");
  const busy = phase.kind !== "ask" && !(phase.kind === "intro" && !phase.tapped);

  const shownLevel = pick ?? level;
  const levelNotes = NOTES.filter((n) => n.level === shownLevel);
  const stepper = (
    <LevelStepper
      level={shownLevel}
      max={3}
      current={level}
      name={LEVEL_NAMES[shownLevel]}
      detail={`${levelNotes.length} notas: ${levelNotes.map((n) => n.name).join(", ")}.${
        shownLevel === level ? "" : " Começa do início deste nível."
      }`}
      onChange={(l) => setPick(l as Level)}
    />
  );

  return (
    <>
      <TopBar
        crumbs={
          <span>
            <Link to="/jogos">Jogos</Link> / Que nota é essa?
          </span>
        }
      />
      <main className="mx-auto max-w-[680px] px-3 pt-4 pb-10 sm:px-4 sm:pt-8">
        <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
          <h1 className="text-[22px] sm:text-[28px]">Que nota é essa?</h1>
          <span className="text-[13px] text-muted">Toque no nome da nota</span>
        </div>
        <div className="relative overflow-hidden rounded-[20px] border border-line bg-surface p-3 shadow-card sm:p-4">
          <GameHud
            level={`Nível ${level} · ${LEVEL_NAMES[level]}`}
            results={game.results}
            total={ROUND_SIZE}
            active={!!note}
            streak={game.streak}
            flashKey={banner?.id}
            unit="notas"
            onLevelClick={chooseLevel}
          />

          <div className="relative mt-3 rounded-[14px] border border-line bg-paper" data-testid="game-stage">
            <NoteStaff
              geo={geo}
              label={note ? "Pauta com clave de sol e uma nota" : "Pauta com clave de sol"}
              xs={[NOTE_X]}
              notes={
                note
                  ? [
                      {
                        step: note.step,
                        key: game.seq,
                        color: colored ? NOTE_COLORS[note.idx] : undefined,
                        className: phase.kind === "bad" ? "g-shake" : "g-drop",
                      },
                    ]
                  : []
              }
            />
            {fx.map((f) => (
              <span
                key={f.id}
                aria-hidden
                style={f.style}
                className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 ${
                  f.kind === "particle"
                    ? "g-particle text-xl"
                    : "g-plus font-display text-[22px] font-bold text-ok"
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
            {phase.kind === "bad" && (
              <span>
                Era <b className="font-display text-lg">{phase.note.name}</b>, que fica {phase.note.place}.
              </span>
            )}
            {phase.kind === "ok" && (
              <b className="font-display text-lg" style={{ color: NOTE_COLORS[phase.note.idx] }}>
                {phase.note.name}!
              </b>
            )}
            {phase.kind === "intro" && (
              <span>
                <b className="font-display text-lg">Nota nova: {phase.note.name}.</b> Fica {phase.note.place}.
                Toque em {phase.note.name}.
              </span>
            )}
          </p>

          <div className="grid grid-cols-12 gap-2 sm:grid-cols-7" role="group" aria-label="Nomes das notas">
            {NAMES.map((name, i) => {
              let state = "";
              if (phase.kind === "ok" && i === phase.answer) state = "ans-ok";
              if (phase.kind === "bad" && i === phase.answer) state = "ans-bad";
              if (phase.kind === "bad" && i === phase.note.idx) state = "ans-reveal";
              if (phase.kind === "intro")
                state = i === phase.note.idx ? (phase.tapped ? "ans-ok" : "ans-intro") : "opacity-40";
              if (shake === i) state = "ans-bad";
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => answer(i)}
                  disabled={busy}
                  aria-label={name}
                  data-testid={`answer-${i}`}
                  style={{ borderBottomColor: NOTE_COLORS[i] }}
                  className={`relative col-span-3 grid min-h-16 cursor-pointer place-items-center content-center rounded-[14px] border-2 border-b-[6px] border-line bg-surface-2 transition hover:-translate-y-px hover:border-accent active:scale-95 disabled:cursor-default sm:col-span-1 [&:nth-child(5)]:col-start-2 sm:[&:nth-child(5)]:col-start-auto ${state}`}
                >
                  <span className="absolute top-1 right-1.5 hidden text-[10px] text-muted sm:block">
                    {i + 1}
                  </span>
                  <span className="font-display text-[21px] leading-tight font-semibold">{name}</span>
                  <span className="text-[11.5px] font-semibold tracking-wide text-muted">{LETTERS[i]}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 text-[12.5px] text-muted">
            <span>
              {mem.introduced} de {NOTES.length} notas
              <span className="hidden sm:inline"> · teclas 1 a 7 ou C D E F G A B</span>
            </span>
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

          {phase.kind === "welcome" && (
            <Overlay>
              <span className="text-xs font-semibold tracking-wider text-accent uppercase">
                {phase.first ? "Jogo de leitura" : "Bem-vindo de volta"}
              </span>
              <h2 className="text-[28px]">{phase.first ? "Que nota é essa?" : `Nível ${level}`}</h2>
              {phase.first ? (
                <p className="text-muted">
                  Vai aparecer uma nota na pauta. Toque no nome dela. Quanto mais você acerta, mais notas
                  aparecem.
                </p>
              ) : (
                <p className="text-muted">
                  {LEVEL_NAMES[level]} · {mem.introduced} de {NOTES.length} notas · melhor sequência{" "}
                  {mem.best}
                  {phase.daysAway > 0 && (
                    <>
                      <br />
                      Faz {phase.daysAway} dias! Vamos aquecer com notas que você já conhece.
                    </>
                  )}
                </p>
              )}
              {stepper}
              <PrimaryButton onClick={start}>Começar</PrimaryButton>
            </Overlay>
          )}

          {phase.kind === "level" && (
            <Overlay>
              <span className="text-xs font-semibold tracking-wider text-accent uppercase">
                Nível {phase.level}
                {phase.chosen ? "" : " desbloqueado"}
              </span>
              <h2 className="text-[28px]">{LEVEL_NAMES[phase.level]}</h2>
              <LevelPreview level={phase.level} />
              <p className="text-[13px] text-muted">Essas notas chegam aos poucos, uma de cada vez.</p>
              <PrimaryButton
                onClick={() =>
                  commit({ ...ref.current, phase: { kind: "intro", note: phase.note, tapped: false } })
                }
              >
                Vamos lá
              </PrimaryButton>
            </Overlay>
          )}

          {phase.kind === "end" && (
            <NoteRoundEnd game={game} onAgain={start}>
              {stepper}
            </NoteRoundEnd>
          )}
        </div>
      </main>
    </>
  );
}

function LevelPreview({ level }: { level: Level }) {
  const notes = NOTES.filter((n) => n.level === level);
  const steps = notes.map((n) => n.step);
  const geo = staffGeometry({
    s: 10,
    top: Math.max(10, ...steps.map((s) => s + 2)),
    bottom: Math.min(-2, ...steps.map((s) => s - 2)),
    margin: 8,
    width: 300,
  });
  const gap = (300 - 64) / notes.length;
  return (
    <div className="w-full max-w-[300px] rounded-[10px] border border-line bg-paper">
      <NoteStaff
        geo={geo}
        label={`Notas do nível ${level}`}
        notes={notes.map((n) => ({ step: n.step, color: NOTE_COLORS[n.idx] }))}
        xs={notes.map((_, i) => 58 + gap * (i + 0.5))}
      />
    </div>
  );
}

function NoteRoundEnd({ game, onAgain, children }: { game: Game; onAgain: () => void; children: ReactNode }) {
  const conf = topConfusion(game.roundConfusions);
  return (
    <RoundEnd
      stars={stars(game.results.filter(Boolean).length)}
      correct={game.results.filter(Boolean).length}
      total={game.results.length}
      best={game.roundBest}
      unit="acertos"
      onAgain={onAgain}
      tip={
        conf ? (
          <>
            Para treinar: você respondeu <b className="text-ink">{NAMES[conf[1]]}</b> quando era{" "}
            <b className="text-ink">{NAMES[conf[0]]}</b>. Essa vai aparecer mais.
          </>
        ) : (
          "Nenhuma troca nesta rodada."
        )
      }
    >
      {children}
    </RoundEnd>
  );
}
