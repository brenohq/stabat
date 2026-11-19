import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { PartPicker } from "../components/PartPicker";
import { TopBar } from "../components/TopBar";
import { ArrowIcon, PersonIcon, SearchIcon } from "../components/icons";
import { Card, Spinner } from "../components/ui";
import { btnClass } from "../components/btnClass";
import { useAsync } from "../hooks/useAsync";
import { fetchIndex, fetchMeta } from "../lib/data";
import { fmtTime, matches } from "../lib/format";
import { shortName } from "../lib/parts";
import { myPart } from "../lib/storage";
import type { ArrangementMeta, ArrangementSummary, Part } from "../lib/types";

async function loadAll(): Promise<{ index: ArrangementSummary[]; metas: ArrangementMeta[] }> {
  const index = await fetchIndex();
  const metas = await Promise.all(index.map((a) => fetchMeta(a.id)));
  return { index, metas };
}

function CoverBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-medium text-white/90 ring-1 ring-white/20 backdrop-blur-sm">
      {children}
    </span>
  );
}

function Cover({ a }: { a: ArrangementSummary }) {
  const [h1, h2] = a.hue ?? [40, 220];
  return (
    <div className="relative flex h-28 flex-col justify-between gap-2 overflow-hidden p-3 pb-2.5 pl-4">
      <svg viewBox="0 0 400 96" preserveAspectRatio="none" aria-hidden className="absolute inset-0 size-full">
        <defs>
          <linearGradient id={`g-${a.id}`} x1="0" x2="1">
            <stop offset="0" stopColor={`hsl(${h1} 55% 42%)`} />
            <stop offset="1" stopColor={`hsl(${h2} 50% 30%)`} />
          </linearGradient>
        </defs>
        <rect width="400" height="96" fill={`url(#g-${a.id})`} />
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1="0" x2="400" y1={30 + i * 9} y2={30 + i * 9} stroke="rgb(255 255 255 / .18)" />
        ))}
      </svg>
      <div className="relative flex flex-wrap gap-1.5">
        <CoverBadge>{a.tempo} bpm</CoverBadge>
        <CoverBadge>{a.time}</CoverBadge>
        <CoverBadge>{a.measures} compassos</CoverBadge>
        <CoverBadge>{fmtTime(a.duration)}</CoverBadge>
      </div>
      <h3 className="relative text-2xl leading-tight text-white [text-shadow:0_1px_8px_rgb(0_0_0/.25)]">
        {a.title}
      </h3>
    </div>
  );
}

function ArrangementCard({
  a,
  meta,
  mine,
}: {
  a: ArrangementSummary;
  meta: ArrangementMeta;
  mine: Part | null;
}) {
  const has = mine && meta.parts.some((p) => p.id === mine.id);
  return (
    <article
      data-testid="arrangement-card"
      className="relative flex flex-col overflow-hidden rounded-[14px] border border-line bg-surface shadow-card transition hover:-translate-y-0.5 hover:border-accent focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
    >
      <Cover a={a} />
      <div className="flex flex-1 flex-col gap-2.5 px-4 pt-3 pb-4">
        {/* link "esticado": o cartão inteiro é clicável */}
        <Link
          to={`/${a.id}`}
          className="text-[13px] text-muted outline-none after:absolute after:inset-0 after:z-[1]"
        >
          {a.subtitle}
        </Link>
        <div className="mt-auto flex">
          {has ? (
            <Link
              to={`/${a.id}/${mine.id}`}
              onClick={() => myPart.set({ id: mine.id, name: mine.name })}
              className={`${btnClass({ primary: true })} relative z-[2] flex-1`}
            >
              Estudar {shortName(mine.name)}
            </Link>
          ) : (
            <span className="flex items-center gap-1 text-[13px] font-semibold text-accent">
              Abrir arranjo <ArrowIcon className="size-3.5" />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function HomePage() {
  const state = useAsync(loadAll, []);
  const [query, setQuery] = useState("");
  const [mineId, setMineId] = useState(() => myPart.get()?.id ?? "");

  // todas as partes de todos os arranjos, na ordem em que aparecem
  const allParts = useMemo(() => {
    if (state.status !== "ok") return [];
    const out: Part[] = [];
    for (const m of state.data.metas)
      for (const p of m.parts) if (!out.some((x) => x.id === p.id)) out.push(p);
    return out;
  }, [state]);
  const mine = allParts.find((p) => p.id === mineId) ?? null;

  const choose = (id: string) => {
    setMineId(id);
    const p = allParts.find((x) => x.id === id);
    myPart.set(p ? { id: p.id, name: p.name } : null);
  };

  return (
    <>
      <TopBar />
      <div className="bg-navy px-4 pt-6 pb-[70px] text-[#f3eee4]">
        <div className="mx-auto max-w-[1200px] px-4">
          <h1 className="text-[clamp(26px,5vw,38px)]">Repertório da banda</h1>
          <p className="mt-2 max-w-[560px] opacity-75">
            Escolha um arranjo, ouça a banda inteira e estude a sua parte em casa.
          </p>
        </div>
      </div>

      <div className="mx-auto -mt-12 max-w-[1200px] px-4">
        <Card
          className={`flex flex-wrap items-center gap-3 px-4 py-3.5 ${
            mine
              ? ""
              : "border-attention animate-attention motion-reduce:animate-none motion-reduce:ring-3 motion-reduce:ring-attention/45"
          }`}
        >
          <div className="grid size-[38px] flex-none place-items-center rounded-[10px] bg-accent-soft text-accent">
            <PersonIcon className="size-5" />
          </div>
          <div className="min-w-[180px] flex-1">
            <b className="block">Qual é a sua parte?</b>
            <span className="text-[13px] text-muted">
              Fica salvo neste aparelho. Cada arranjo ganha um atalho direto para ela.
            </span>
          </div>
          <PartPicker
            id="mypart"
            label="Minha parte"
            parts={allParts}
            value={mineId || null}
            onChange={(id) => choose(id ?? "")}
            placeholder="Escolher minha parte"
            clearable
            className="w-full sm:w-[260px]"
          />
        </Card>
      </div>

      <main className="mx-auto mt-7 mb-16 max-w-[1200px] px-4">
        <div className="mb-3.5 flex flex-wrap items-center gap-3">
          <h2 className="flex-1 text-xl">Arranjos publicados</h2>
          <label className="relative block w-full">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input
              id="q"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar arranjo…"
              aria-label="Buscar arranjo"
              autoComplete="off"
              className="w-full rounded-[10px] border border-line bg-surface py-2 pr-3 pl-9 focus:border-accent focus:outline-2 focus:outline-accent"
            />
          </label>
        </div>
        {state.status === "loading" && <Spinner label="Carregando repertório…" />}
        {state.status === "error" && <p className="text-muted">{state.error.message}</p>}
        {state.status === "ok" && (
          <Cards index={state.data.index} metas={state.data.metas} query={query} mine={mine} />
        )}
      </main>
      <p className="mx-auto max-w-[1200px] px-4 pb-10 text-xs text-muted">
        Áudio gerado com Muse Sounds no MuseScore Studio.
      </p>
    </>
  );
}

function Cards({
  index,
  metas,
  query,
  mine,
}: {
  index: ArrangementSummary[];
  metas: ArrangementMeta[];
  query: string;
  mine: Part | null;
}) {
  const shown = index
    .map((a, i) => ({ a, meta: metas[i]! }))
    .filter(({ a }) => matches(query, `${a.title} ${a.subtitle}`));
  if (!shown.length) return <p className="py-5 text-muted">Nenhum arranjo encontrado.</p>;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
      {shown.map(({ a, meta }) => (
        <ArrangementCard key={a.id} a={a} meta={meta} mine={mine} />
      ))}
    </div>
  );
}
