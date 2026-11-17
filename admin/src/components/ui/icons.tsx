import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IconHome = (p: IconProps) => (
  <svg {...base} {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1v-9" /></svg>
);
export const IconShieldCheck = (p: IconProps) => (
  <svg {...base} {...p}><path d="M12 3.5 5 6v6c0 4.5 3 7.5 7 8.5 4-1 7-4 7-8.5V6l-7-2.5Z" /><path d="m9 12 2 2 4-4.5" /></svg>
);
export const IconMap = (p: IconProps) => (
  <svg {...base} {...p}><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6l-6-2Z" /><path d="M9 4v14M15 6v14" /></svg>
);
export const IconRoute = (p: IconProps) => (
  <svg {...base} {...p}><circle cx="6" cy="19" r="2.2" /><circle cx="18" cy="5" r="2.2" /><path d="M6 16.8V13a4 4 0 0 1 4-4h4a4 4 0 0 0 4-4" /></svg>
);
export const IconWallet = (p: IconProps) => (
  <svg {...base} {...p}><rect x="3" y="6.5" width="18" height="13" rx="2.2" /><path d="M3 10.5h18" /><circle cx="16.5" cy="14.5" r="1.1" fill="currentColor" stroke="none" /></svg>
);
export const IconUsers = (p: IconProps) => (
  <svg {...base} {...p}><circle cx="9" cy="8" r="3" /><path d="M3.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6" /><circle cx="17" cy="9" r="2.3" /><path d="M15.7 14.2c2.4.4 4.3 2.6 4.3 5.3" /></svg>
);
export const IconGift = (p: IconProps) => (
  <svg {...base} {...p}><rect x="4" y="9.5" width="16" height="10.5" rx="1.5" /><path d="M4 13.5h16" /><path d="M12 9.5V20" /><path d="M12 9.5C9.5 9.5 8 8.3 8 6.6 8 5.2 9 4 10.4 4c1.5 0 1.6 2.2 1.6 5.5Z" /><path d="M12 9.5c2.5 0 4-1.2 4-2.9C16 5.2 15 4 13.6 4 12.1 4 12 6.2 12 9.5Z" /></svg>
);
export const IconChat = (p: IconProps) => (
  <svg {...base} {...p}><path d="M4 12c0-4.4 3.8-8 8.4-8S21 7.6 21 12s-3.8 8-8.6 8c-1 0-2-.16-2.9-.46L5 21l1.2-3.7C4.8 15.9 4 14 4 12Z" /></svg>
);
export const IconSettings = (p: IconProps) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2.1 2.1 0 1 1-2.97 2.97l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.55V20a2.1 2.1 0 0 1-4.2 0v-.09A1.7 1.7 0 0 0 8.6 18.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2.1 2.1 0 1 1-2.97-2.97l.06-.06a1.7 1.7 0 0 0 .34-1.87A1.7 1.7 0 0 0 2.55 12.6H2.45a2.1 2.1 0 0 1 0-4.2h.09A1.7 1.7 0 0 0 4.09 7.4a1.7 1.7 0 0 0-.34-1.87l-.06-.06A2.1 2.1 0 1 1 6.66 2.5l.06.06c.5.5 1.25.65 1.87.34h.05A1.7 1.7 0 0 0 9.66 1.35V1.25a2.1 2.1 0 0 1 4.2 0v.09c0 .68.4 1.28 1.03 1.55h.05c.62.3 1.37.16 1.87-.34l.06-.06a2.1 2.1 0 1 1 2.97 2.97l-.06.06c-.5.5-.64 1.25-.34 1.87v.05c.27.62.87 1.03 1.55 1.03h.1a2.1 2.1 0 0 1 0 4.2h-.09a1.7 1.7 0 0 0-1.55 1.03Z" /></svg>
);
export const IconLogout = (p: IconProps) => (
  <svg {...base} {...p}><path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3" /><path d="M16 17 21 12 16 7" /><path d="M21 12H9" /></svg>
);
export const IconChevronRight = (p: IconProps) => (
  <svg {...base} {...p}><path d="m9 6 6 6-6 6" /></svg>
);
export const IconCheck = (p: IconProps) => (
  <svg {...base} {...p}><path d="M5 13l4.5 4.5L19 7" /></svg>
);
export const IconX = (p: IconProps) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconDownload = (p: IconProps) => (
  <svg {...base} {...p}><path d="M12 3.5v12" /><path d="m7 11 5 5 5-5" /><path d="M4.5 19.5h15" /></svg>
);
export const IconFileText = (p: IconProps) => (
  <svg {...base} {...p}><path d="M7 3.5h7l4 4V19a1.2 1.2 0 0 1-1.2 1.2H7A1.2 1.2 0 0 1 5.8 19V4.7A1.2 1.2 0 0 1 7 3.5Z" /><path d="M14 3.5V8h4.2" /><path d="M9 12.5h6M9 15.8h6" /></svg>
);
export const IconAlertTriangle = (p: IconProps) => (
  <svg {...base} {...p}><path d="M12 4 2.5 20h19L12 4Z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.3" r="0.15" fill="currentColor" /></svg>
);
export const IconClock = (p: IconProps) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
);
export const IconSearch = (p: IconProps) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></svg>
);
export const IconCar = (p: IconProps) => (
  <svg {...base} {...p}><path d="M4 16v-2.5L5.8 8.9A2 2 0 0 1 7.7 7.5h8.6a2 2 0 0 1 1.9 1.4L20 13.5V16" /><rect x="3" y="16" width="18" height="4" rx="1.3" /><circle cx="7.5" cy="16" r="1.4" /><circle cx="16.5" cy="16" r="1.4" /></svg>
);
export const IconPhone = (p: IconProps) => (
  <svg {...base} {...p}><path d="M5 4.5h3.2L10 9l-2 1.3a10.4 10.4 0 0 0 5.7 5.7L15 14l4.5 1.8V19a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 3.5 6.1 1.5 1.5 0 0 1 5 4.5Z" /></svg>
);
export const IconEdit = (p: IconProps) => (
  <svg {...base} {...p}><path d="M14.5 4.5 19 9l-9.5 9.5-5 1 1-5 9-9Z" /><path d="M13 6l4.5 4.5" /></svg>
);
export const IconPlus = (p: IconProps) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconMinus = (p: IconProps) => (
  <svg {...base} {...p}><path d="M5 12h14" /></svg>
);
export const IconShield = (p: IconProps) => (
  <svg {...base} {...p}><path d="M12 3.5 5 6v6c0 4.5 3 7.5 7 8.5 4-1 7-4 7-8.5V6l-7-2.5Z" /></svg>
);
