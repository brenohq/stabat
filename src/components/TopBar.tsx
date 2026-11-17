import { Link, NavLink } from "react-router";
import type { ReactNode } from "react";
import { CalendarIcon, NoteIcon } from "./icons";

export function TopBar({ crumbs }: { crumbs?: ReactNode }) {
  return (
    <header className="flex items-center gap-3.5 bg-navy px-4 py-3 text-[#f3eee4]">
      <Link
        to="/"
        className="flex flex-none items-center gap-2 font-display text-[22px] font-semibold no-underline"
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
      <NavLink
        to="/calendario"
        className={({ isActive }) =>
          `ml-auto flex flex-none items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium no-underline transition hover:bg-white/10 ${
            isActive ? "bg-white/15" : ""
          }`
        }
      >
        <CalendarIcon className="size-4" />
        Calendário da Banda
      </NavLink>
    </header>
  );
}
