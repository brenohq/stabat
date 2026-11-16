import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { partGain } from "../lib/mix";
import { FAMILY_LABEL, byFamily, familyOf, shortName } from "../lib/parts";
import { myPart, prefs } from "../lib/storage";
import type { Family, Part } from "../lib/types";
import { CaretIcon } from "./icons";

const FAMILY_COLOR: Record<Family, string> = {
  wood: "bg-wood",
  "brass-hi": "bg-brass-hi",
  "brass-lo": "bg-brass-lo",
};

function Switch({
  state,
  onClick,
  label,
}: {
  state: "on" | "off" | "some";
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={state === "on" ? "true" : state === "some" ? "mixed" : "false"}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.preventDefault(); // não abre/fecha o grupo
        onClick();
      }}
      className={`relative h-[17px] w-[30px] flex-none cursor-pointer rounded-full transition-colors after:absolute after:top-0.5 after:size-[13px] after:rounded-full after:bg-white after:transition-[left] ${
        state === "on"
          ? "bg-accent after:left-[15px]"
          : state === "some"
            ? "bg-[color-mix(in_srgb,var(--accent)_50%,var(--line))] after:left-[8.5px]"
            : "bg-line after:left-0.5"
      }`}
    />
  );
}

interface Props {
  arrangementId: string;
  parts: Part[];
  on: Set<number>;
  solo: Set<number>;
  myPartId: string | null;
  onChange: (on: Set<number>, solo: Set<number>) => void;
}

/** instrumentos agrupados por família (grupos recolhíveis, fechados por padrão,
 *  menos o da parte do músico, que sempre abre aberto para o "você" aparecer de cara) */
export function Mixer({ arrangementId, parts, on, solo, myPartId, onChange }: Props) {
  const [open, setOpen] = useState<string[]>(() => {
    const saved = prefs.get<string[]>("openFams", []);
    const mine = parts.find((p) => p.id === myPartId);
    const f = mine && familyOf(mine.name);
    return f && !saved.includes(f) ? [...saved, f] : saved;
  });
  // painel com rolagem própria: traz a linha "você" para dentro dele (sem rolar a página)
  const mineRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = mineRow.current;
    const box = row?.closest<HTMLElement>("[data-testid=mixer-panel]");
    if (!row || !box) return;
    const r = row.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom + 8;
  }, []);
  const toggleOpen = (f: Family, isOpen: boolean) => {
    const next = isOpen ? [...new Set([...open, f])] : open.filter((x) => x !== f);
    setOpen(next);
    prefs.set("openFams", next);
  };
  const setOn = (i: number, v: boolean) => {
    const n = new Set(on);
    if (v) n.add(i);
    else n.delete(i);
    onChange(n, solo);
  };
  const toggleSolo = (i: number) => {
    const n = new Set(solo);
    if (n.has(i)) n.delete(i);
    else n.add(i);
    onChange(on, n);
  };

  return (
    <div data-testid="mixer">
      {byFamily(parts).map(([f, ps]) => {
        const ids = ps.map((p) => p.index);
        const playing = ids.filter((i) => partGain(i, on, solo) > 0).length;
        const allOn = ids.every((i) => on.has(i));
        const anyOn = ids.some((i) => on.has(i));
        return (
          <details
            key={f}
            open={open.includes(f)}
            onToggle={(e) => toggleOpen(f, (e.currentTarget as HTMLDetailsElement).open)}
            className="group border-t border-line open:pb-1.5"
            data-family={f}
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold select-none [&::-webkit-details-marker]:hidden">
              <CaretIcon className="size-3.5 flex-none text-muted transition-transform group-open:rotate-90" />
              <i className={`inline-block size-2 flex-none rounded-[2px] ${FAMILY_COLOR[f]}`} />
              <span className="flex-1">{FAMILY_LABEL[f]}</span>
              <span className="text-xs font-normal text-muted" data-testid="family-count">
                {playing}/{ids.length}
              </span>
              <Switch
                state={allOn ? "on" : anyOn ? "some" : "off"}
                label={`Ligar/desligar ${FAMILY_LABEL[f].toLowerCase()}`}
                onClick={() => {
                  const n = new Set(on);
                  ids.forEach((i) => (allOn ? n.delete(i) : n.add(i)));
                  onChange(n, solo);
                }}
              />
            </summary>
            {ps.map((p) => {
              const audible = partGain(p.index, on, solo) > 0;
              return (
                <div
                  key={p.id}
                  ref={myPartId === p.id ? mineRow : undefined}
                  className="grid grid-cols-[22px_1fr_auto_auto] items-center gap-2 px-3.5 py-1.5 hover:bg-surface-2"
                  data-part={p.id}
                >
                  <input
                    type="checkbox"
                    id={`c${p.index}`}
                    checked={on.has(p.index)}
                    onChange={(e) => setOn(p.index, e.target.checked)}
                    className="m-0 size-4 accent-accent"
                  />
                  <label
                    htmlFor={`c${p.index}`}
                    className={`cursor-pointer truncate text-sm ${audible ? "" : "text-muted line-through decoration-line"}`}
                  >
                    {shortName(p.name)}
                    {myPartId === p.id && (
                      <span className="ml-1.5 rounded bg-accent-soft px-1.5 py-px text-[10px] font-semibold tracking-wide text-accent uppercase">
                        você
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    aria-pressed={solo.has(p.index)}
                    title={`Solo: só ${shortName(p.name)}`}
                    aria-label={`Solo: só ${shortName(p.name)}`}
                    onClick={() => toggleSolo(p.index)}
                    className={`h-[22px] w-6 cursor-pointer rounded-md border text-[11px] font-semibold ${
                      solo.has(p.index)
                        ? "border-[#e2b33c] bg-[#e2b33c] text-[#2a1d00]"
                        : "border-line bg-surface text-muted"
                    }`}
                  >
                    S
                  </button>
                  <Link
                    to={`/${arrangementId}/${p.id}`}
                    onClick={() => myPart.set({ id: p.id, name: p.name })}
                    className="text-xs font-semibold whitespace-nowrap text-accent hover:underline"
                  >
                    parte →
                  </Link>
                </div>
              );
            })}
          </details>
        );
      })}
    </div>
  );
}
