import { Link } from "react-router";
import type { ReactNode } from "react";
import { NoteIcon } from "./icons";

export function TopBar({ crumbs }: { crumbs?: ReactNode }) {
  return (
    <header className="flex items-center gap-3.5 bg-navy px-4 py-3 text-[#f3eee4]">
      <Link to="/" className="flex items-center gap-2 font-display text-[22px] font-semibold no-underline">
        <NoteIcon className="size-[22px]" />
        stabat
      </Link>
      {crumbs && (
        <nav
          className="hidden truncate text-[13px] opacity-75 sm:block [&_a:hover]:underline"
          aria-label="Navegação"
        >
          {crumbs}
        </nav>
      )}
    </header>
  );
}
