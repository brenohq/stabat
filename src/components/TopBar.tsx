import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { BookIcon, CalendarIcon, ChevronDownIcon, CloseIcon, GameIcon, MenuIcon, NoteIcon } from "./icons";

const itemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[15px] no-underline transition-colors hover:bg-surface-2 [&_svg]:size-[18px] [&_svg]:flex-none ${
    isActive ? "bg-accent-soft font-semibold" : ""
  }`;

/** menu do topo, nesta ordem: Calendário da Banda, Estudos e o grupo recolhível Jogos */
function SiteMenu() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(() => pathname.startsWith("/jogos"));
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  return (
    <div ref={root} className="relative ml-auto flex-none">
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={() => setOpen((o) => !o)}
        className={`flex size-10 items-center justify-center rounded-lg transition hover:bg-white/10 ${
          open ? "bg-white/15" : ""
        }`}
      >
        {open ? <CloseIcon className="size-6" /> : <MenuIcon className="size-6" />}
      </button>
      {open && (
        <nav
          id="site-menu"
          aria-label="Menu"
          className="absolute top-full right-0 z-50 mt-2 w-[min(300px,calc(100vw-24px))] animate-[pop-in_.15s_ease-out] rounded-[14px] border border-line bg-surface p-2 text-ink shadow-card"
        >
          <NavLink to="/calendario" className={itemClass} onClick={close}>
            <CalendarIcon />
            Calendário da Banda
          </NavLink>
          <NavLink to="/estudos" className={itemClass} onClick={close}>
            <BookIcon />
            Estudos
          </NavLink>
          <button
            type="button"
            aria-expanded={gamesOpen}
            aria-controls="menu-games"
            onClick={() => setGamesOpen((o) => !o)}
            className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-surface-2 [&_svg]:size-[18px] [&_svg]:flex-none"
          >
            <GameIcon />
            Jogos
            <ChevronDownIcon
              className={`ml-auto text-muted transition-transform ${gamesOpen ? "rotate-180" : ""}`}
            />
          </button>
          {gamesOpen && (
            <div id="menu-games" className="ml-[22px] border-l border-line pl-2">
              <NavLink to="/jogos" end className={itemClass} onClick={close}>
                Todos os jogos
              </NavLink>
              <NavLink to="/jogos/que-nota" className={itemClass} onClick={close}>
                Que nota é essa?
              </NavLink>
              <NavLink to="/jogos/ritmo" className={itemClass} onClick={close}>
                Bate o ritmo
              </NavLink>
            </div>
          )}
        </nav>
      )}
    </div>
  );
}

export function TopBar({ crumbs }: { crumbs?: ReactNode }) {
  return (
    <header className="flex items-center gap-3.5 bg-navy px-4 py-2 text-[#f3eee4]">
      <Link
        to="/"
        className="flex flex-none items-center gap-2 py-1 font-display text-[22px] font-semibold no-underline"
      >
        <NoteIcon className="size-[22px]" />
        stabat
      </Link>
      {crumbs && (
        <nav
          className="hidden min-w-0 truncate text-[13px] opacity-75 sm:block [&_a:hover]:underline"
          aria-label="Navegação"
        >
          {crumbs}
        </nav>
      )}
      <SiteMenu />
    </header>
  );
}
