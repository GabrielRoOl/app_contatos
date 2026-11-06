import type { ReactNode } from 'react';

type P = { size?: number; strokeWidth?: number };

function Svg({ size = 20, strokeWidth = 2.2, children }: P & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconPlus = (p: P) => <Svg strokeWidth={2.4} {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconCheck = (p: P) => <Svg strokeWidth={2.8} {...p}><path d="M5 12.5l4.5 4.5L19 7" /></Svg>;
export const IconX = (p: P) => <Svg strokeWidth={2.8} {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const IconCalendar = (p: P) => <Svg strokeWidth={2} {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Svg>;
export const IconChevronLeft = (p: P) => <Svg strokeWidth={2.4} {...p}><path d="M15 5l-7 7 7 7" /></Svg>;
export const IconChevronRight = (p: P) => <Svg strokeWidth={2.4} {...p}><path d="M9 5l7 7-7 7" /></Svg>;
export const IconChevronDown = (p: P) => <Svg strokeWidth={2.4} {...p}><path d="M6 9l6 6 6-6" /></Svg>;
export const IconChevronUp = (p: P) => <Svg strokeWidth={2.4} {...p}><path d="M6 15l6-6 6 6" /></Svg>;
export const IconClock = (p: P) => <Svg strokeWidth={2.6} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>;
export const IconCopy = (p: P) => <Svg {...p}><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" /></Svg>;
export const IconSend = (p: P) => <Svg {...p}><path d="M21 3L10.5 13.5" /><path d="M21 3l-6.5 18-4-7.5L3 9.5 21 3z" /></Svg>;
export const IconUndo = (p: P) => <Svg strokeWidth={2.6} {...p}><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Svg>;
export const IconTrash = (p: P) => <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" /></Svg>;
export const IconSun = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></Svg>;
export const IconSunset = (p: P) => <Svg {...p}><path d="M7 17a5 5 0 0 1 10 0" /><path d="M3 17h18M3 21h18M12 7v3M5.6 10.6l1.4 1.4M18.4 10.6L17 12" /></Svg>;
export const IconSliders = (p: P) => <Svg {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></Svg>;
