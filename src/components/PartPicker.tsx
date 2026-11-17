import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { FAMILY_LABEL, byFamily, familyOf, partNumber } from "../lib/parts";
import type { Part } from "../lib/types";
import { FAMILY_COLOR } from "./familyColor";
import { CheckIcon, ChevronDownIcon, PersonIcon } from "./icons";

interface Props {
  /** id do botão (os testes usam) */
  id: string;
  /** nome acessível e título do painel no celular */
  label: string;
  parts: Part[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  /** oferece "Limpar escolha" quando há valor */
  clearable?: boolean;
  className?: string;
}

/** id "" = a opção "Limpar escolha" */
const CLEAR = "";

/**
 * Seletor de parte: botão com a parte escolhida e lista agrupada por família.
 * No computador abre logo abaixo; no celular sobe do rodapé. Teclado: setas, Home/End,
 * Enter, Esc e digitar a inicial (listbox do ARIA com aria-activedescendant).
 */
export function PartPicker({
  id,
  label,
  parts,
  value,
  onChange,
  placeholder = "Escolher parte",
  clearable,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>(CLEAR);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const uid = useId();

  const groups = useMemo(() => byFamily(parts), [parts]);
  const selected = parts.find((p) => p.id === value) ?? null;
  // ordem de navegação pelo teclado: a mesma da tela
  const nav = useMemo(() => {
    const ids = groups.flatMap(([, ps]) => ps.map((p) => p.id));
    return clearable && selected ? [...ids, CLEAR] : ids;
  }, [groups, clearable, selected]);
  const optId = (pid: string) => `${uid}-opt-${pid || "limpar"}`;

  const show = () => {
    setActive(selected?.id ?? nav[0] ?? CLEAR);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const pick = (pid: string) => {
    close();
    if (pid !== (value ?? CLEAR)) onChange(pid || null);
  };

  useEffect(() => {
    if (!open) return;
    list.current?.focus({ preventScroll: true });
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  useEffect(() => {
    if (open)
      document.getElementById(`${uid}-opt-${active || "limpar"}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, uid]);

  const onListKey = (e: KeyboardEvent) => {
    const i = nav.indexOf(active);
    const go = (j: number) => setActive(nav[Math.max(0, Math.min(nav.length - 1, j))] ?? CLEAR);
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(nav.length - 1);
    else if (e.key === "Enter" || e.key === " ") pick(active);
    else if (e.key === "Escape") close();
    else if (e.key === "Tab") return setOpen(false);
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // digitar "tu" vai até a primeira Tuba
      const now = e.timeStamp;
      const t = typed.current;
      t.text = (now - t.at > 700 ? "" : t.text) + e.key.toLowerCase();
      t.at = now;
      const hit = parts.find((p) => p.name.toLowerCase().startsWith(t.text));
      if (hit) setActive(hit.id);
    } else return;
    e.preventDefault();
  };

  const family = selected && familyOf(selected.name);

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        ref={trigger}
        id={id}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-value={value ?? ""}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show();
          }
        }}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-[12px] border border-line bg-surface py-1.5 pr-2.5 pl-1.5 text-left transition hover:border-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent aria-expanded:border-accent aria-expanded:ring-3 aria-expanded:ring-accent-soft"
      >
        <span
          className={`grid size-9 flex-none place-items-center rounded-[9px] ${
            family ? `${FAMILY_COLOR[family]} text-white` : "bg-accent-soft text-accent"
          }`}
          aria-hidden
        >
          {selected ? (
            <span className="font-display text-lg font-semibold">{partNumber(selected.name) || "♪"}</span>
          ) : (
            <PersonIcon className="size-[18px]" />
          )}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          {selected ? (
            <>
              <span className="block truncate font-semibold">{selected.name}</span>
              <span className="block text-xs text-muted">{FAMILY_LABEL[family!]}</span>
            </>
          ) : (
            <span className="block text-muted">{placeholder}</span>
          )}
        </span>
        <ChevronDownIcon
          className={`size-4 flex-none text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          {/* no celular: fundo escuro; tocar fora fecha */}
          <div
            className="fixed inset-0 z-40 bg-black/35 sm:hidden"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[75vh] animate-[sheet-in_.18s_ease-out] flex-col overflow-hidden rounded-t-[18px] border border-line bg-surface pb-[env(safe-area-inset-bottom,0px)] shadow-card motion-reduce:animate-none sm:absolute sm:inset-x-auto sm:right-0 sm:bottom-auto sm:mt-2 sm:max-h-[min(440px,65vh)] sm:w-[300px] sm:animate-[pop-in_.12s_ease-out] sm:rounded-[14px] sm:pb-0">
            <div className="flex flex-none flex-col items-center border-b border-line px-4 pt-2 pb-3 sm:hidden">
              <span className="mb-2.5 h-1 w-10 rounded-full bg-line" aria-hidden />
              <b className="font-display text-lg">{label}</b>
            </div>
            <div
              ref={list}
              role="listbox"
              tabIndex={-1}
              aria-label={label}
              aria-activedescendant={optId(active)}
              onKeyDown={onListKey}
              className="overflow-y-auto overscroll-contain p-1.5 outline-none"
            >
              {groups.map(([f, ps]) => (
                <div key={f} role="group" aria-labelledby={`${uid}-${f}`} className="not-first:mt-1.5">
                  <div
                    id={`${uid}-${f}`}
                    className="flex items-center gap-2 px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase"
                  >
                    <i className={`size-2 rounded-[2px] ${FAMILY_COLOR[f]}`} />
                    {FAMILY_LABEL[f]}
                  </div>
                  {ps.map((p) => {
                    const sel = p.id === value;
                    return (
                      <div
                        key={p.id}
                        id={optId(p.id)}
                        role="option"
                        aria-selected={sel}
                        data-part={p.id}
                        onClick={() => pick(p.id)}
                        onPointerMove={() => setActive(p.id)}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-[9px] px-2.5 py-2.5 text-[15px] sm:py-2 sm:text-sm ${
                          active === p.id ? "bg-accent-soft" : ""
                        } ${sel ? "font-semibold" : ""}`}
                      >
                        <span className="flex-1">{p.name}</span>
                        {sel && <CheckIcon className="size-4 text-accent" />}
                      </div>
                    );
                  })}
                </div>
              ))}
              {clearable && selected && (
                <div
                  id={optId(CLEAR)}
                  role="option"
                  aria-selected={false}
                  onClick={() => pick(CLEAR)}
                  onPointerMove={() => setActive(CLEAR)}
                  className={`mt-1.5 cursor-pointer rounded-[9px] border-t border-line px-2.5 py-2.5 text-sm text-muted sm:py-2 ${
                    active === CLEAR ? "bg-accent-soft" : ""
                  }`}
                >
                  Limpar escolha
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
