import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export const PlayIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
  </svg>
);
export const PauseIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <rect x="6" y="5" width="4.2" height="14" rx="1.2" />
    <rect x="13.8" y="5" width="4.2" height="14" rx="1.2" />
  </svg>
);
export const BackIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden {...p}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
export const ArrowIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const LoopIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden {...p}>
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11V9a3 3 0 0 1 3-3h15" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v2a3 3 0 0 1-3 3H3" />
  </svg>
);
export const RewindIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <rect x="5" y="5" width="2.4" height="14" rx="1" />
    <path d="M19 6.2v11.6a.8.8 0 0 1-1.25.66L9.4 12.66a.8.8 0 0 1 0-1.32l8.35-5.8A.8.8 0 0 1 19 6.2z" />
  </svg>
);
export const MetronomeIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden {...p}>
    <path d="M9 3h6l4 18H5z" />
    <path d="M12 15l5-9" />
  </svg>
);
export const PersonIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </svg>
);
export const CaretIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.5} aria-hidden {...p}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
export const SearchIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);
export const ZoomInIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5L21 21M10.5 7.8v5.4M7.8 10.5h5.4" />
  </svg>
);
export const ZoomOutIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5L21 21M7.8 10.5h5.4" />
  </svg>
);
export const CalendarIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);
export const NoteIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M10 3.5v11.1A3.5 3.5 0 1 0 12 17.7V8.2l7-1.7v6.1a3.5 3.5 0 1 0 2 3.1V2.6z" />
  </svg>
);
export const CheckIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.5} aria-hidden {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const ChevronDownIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} strokeWidth={2.5} aria-hidden {...p}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const PrinterIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden {...p}>
    <path d="M7 9V3h10v6" />
    <rect x="3" y="9" width="18" height="8" rx="2" />
    <path d="M7 14h10v7H7z" />
  </svg>
);
export const DownloadIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden {...p}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);
export const CloseIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const MenuIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const GameIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden {...p}>
    <path d="M7 8h10a4 4 0 0 1 4 4v1.5a3.5 3.5 0 0 1-6.3 2.1L14 14.5h-4l-.7 1.1A3.5 3.5 0 0 1 3 13.5V12a4 4 0 0 1 4-4z" />
    <path d="M8 10.5v3M6.5 12h3M15.5 11.5h.01M17.5 13h.01" />
  </svg>
);
export const SoundIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </svg>
);
export const MuteIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M16 9.5l5 5M21 9.5l-5 5" />
  </svg>
);
export const BookIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden {...p}>
    <path d="M5 5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2z" />
    <path d="M5 20a2 2 0 0 0 2 2h12v-4" />
    <path d="M9 7.5h6M9 11h4" />
  </svg>
);
export const TunerIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden {...p}>
    <path d="M3.5 17a8.5 8.5 0 0 1 17 0" />
    <path d="M12 17l3.5-5.5" />
    <circle cx="12" cy="17" r="1.3" fill="currentColor" />
    <path d="M12 8.5v1.5M6 11l1 1M18 11l-1 1" />
  </svg>
);
export const MicIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
  </svg>
);
