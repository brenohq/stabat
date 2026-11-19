import type { SVGProps } from "react";
import { instrumentOf, type Instrument } from "../lib/parts";
import { NoteIcon } from "./icons";

/** traços dos ícones de instrumento (24×24); sax alto e tenor usam o mesmo */
const PATHS: Record<Instrument, string[]> = {
  clarinet: [
    "M10.75 2.75h2.5v3.5h-2.5z",
    "M10.5 6.25h3v10.75l1.5 4.25h-6l1.5-4.25z",
    "M12 9.75h.01M12 13h.01",
  ],
  sax: [
    "M7.25 5.75v10a4.75 4.75 0 0 0 9.5 0V12l2.75-3.75h-7L13.75 12v3.75a1.75 1.75 0 0 1-3.5 0v-10a1.5 1.5 0 0 0-3 0",
    "M8.75 4.25c0-1-1-1.5-3.75-1.5",
    "M8.75 8.75h.01M8.75 11.75h.01",
  ],
  trumpet: [
    "M21.25 6.25v11.5",
    "M21.25 6.25c-1.5 2.5-3.5 4.75-5.25 5.75c1.75 1 3.75 3.25 5.25 5.75",
    "M2.75 12H16M2.75 10.25v3.5",
    "M5.75 12v3.25a2.25 2.25 0 0 0 2.25 2.25h3.25a2.25 2.25 0 0 0 2.25-2.25V12",
    "M7.75 12V8M10.5 12V8M13.25 12V8M6.75 8h2M9.5 8h2M12.25 8h2",
  ],
  saxhorn: [
    "M12 2.75h6.5",
    "M12 2.75c1 1 1.5 2.5 1.5 4.5v3.25M18.5 2.75c-1.25 1-2.5 2.5-2.5 4.5V15.5",
    "M16 15.5a5 5.75 0 1 1-2.5-4.98",
    "M10.5 18a2 2 0 1 0 0-4a2 2 0 1 0 0 4z",
    "M6.75 12.5L4 9.75",
  ],
  trombone: [
    "M5.25 3.5v8",
    "M5.25 3.5c1.5 2 3 3.5 4.75 4c-1.75.5-3.25 2-4.75 4",
    "M10 7.5h9.25a2 2 0 0 1 2 2V15",
    "M21.25 15H5.25a2.75 2.75 0 0 0 0 5.5h16",
    "M15 7.5V15",
  ],
  euphonium: [
    "M14 3l7.5 3.5",
    "M14 3c.75 2.5.75 5-.25 7.25L13 13.2M21.5 6.5c-2.5.25-4.75 2-6.25 4.25l-1 3.6",
    "M4 16.5a5.5 4.25 0 1 0 11 0a5.5 4.25 0 1 0-11 0",
    "M7.25 12.6V8.75M10 12.3V8.75M6.25 8.75h2M9 8.75h2",
  ],
  tuba: [
    "M4.25 2.75h15.5",
    "M4.25 2.75c3.25 1 5.25 3.25 5.75 6.5M19.75 2.75c-3.25 1-5.25 3.25-5.75 6.5",
    "M10 9.25a6 6 0 1 0 4 0",
    "M12 17.5a2.25 2.25 0 1 0 0-4.5a2.25 2.25 0 1 0 0 4.5z",
    "M17.75 12.5h2.5M18 15.25h2.5",
    "M6.5 12.25L3.75 9.5",
  ],
  sousaphone: [
    "M9.25 21.25a6.25 6.25 0 1 0 0-12.5a6.25 6.25 0 1 0 0 12.5z",
    "M9.25 17.75a2.75 2.75 0 1 0 0-5.5a2.75 2.75 0 1 0 0 5.5z",
    "M9.25 8.75c1.75-2 4-3 6.5-3",
    "M21.25 1.5v9",
    "M21.25 1.5c-1.5 2-3.5 3.5-5.5 4.25c2 .75 4 2.25 5.5 4.25",
  ],
};

/** ícone do instrumento da parte ("Tuba Mib 1" → tuba); sem ícone próprio, uma nota */
export function InstrumentIcon({ name, ...p }: { name: string } & SVGProps<SVGSVGElement>) {
  const inst = instrumentOf(name);
  if (!inst) return <NoteIcon {...p} />;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      data-instrument={inst}
      {...p}
    >
      {PATHS[inst].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
