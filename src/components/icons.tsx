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
export const NoteIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M10 3.5v11.1A3.5 3.5 0 1 0 12 17.7V8.2l7-1.7v6.1a3.5 3.5 0 1 0 2 3.1V2.6z" />
  </svg>
);
