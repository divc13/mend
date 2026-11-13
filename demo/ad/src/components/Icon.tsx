import React from 'react';
import type { CSSProperties } from 'react';

export type IconName =
  | 'check'
  | 'arrowRight'
  | 'arrowDown'
  | 'lock'
  | 'camera'
  | 'pin'
  | 'file'
  | 'hammer'
  | 'eye'
  | 'shield'
  | 'wallet'
  | 'spark'
  | 'users'
  | 'vote'
  | 'receipt'
  | 'link'
  | 'clock'
  | 'x'
  | 'play'
  | 'chevronRight'
  | 'database'
  | 'server'
  | 'code'
  | 'globe'
  | 'refresh'
  | 'alert'
  | 'plus'
  | 'qr'
  | 'layers'
  | 'map'
  | 'key'
  | 'scan';

type IconProps = {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  color?: string;
  style?: CSSProperties;
};

const paths: Record<IconName, React.ReactNode> = {
  check: <path d="M4 12.5l5 5L20 6.5" />,
  arrowRight: <path d="M4 12h16M13 5l7 7-7 7" />,
  arrowDown: <path d="M12 4v16M5 13l7 7 7-7" />,
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 018 0v3" />
      <path d="M12 14v3" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  file: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </>
  ),
  hammer: (
    <>
      <path d="M14 6l4 4M3 21l7-7" />
      <path d="M12 4l8 8-3 3-8-8z" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M3 10h18M16 14h2" />
    </>
  ),
  spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 20c0-2.8 2.2-5 5-5" />
    </>
  ),
  vote: (
    <>
      <path d="M4 11l8-7 8 7" />
      <path d="M6 10v10h12V10" />
      <path d="M9 15l2 2 4-4" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1" />
      <path d="M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6L6 18" />,
  play: <path d="M8 5l11 7-11 7z" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  database: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </>
  ),
  server: (
    <>
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="13" width="18" height="7" rx="2" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </>
  ),
  code: <path d="M8 6l-5 6 5 6M16 6l5 6-5 6M14 4l-4 16" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 4 5.7 4 9s-1.5 6.4-4 9c-2.5-2.6-4-5.7-4-9s1.5-6.4 4-9z" />
    </>
  ),
  refresh: <path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" />,
  alert: (
    <>
      <path d="M12 3l10 18H2z" />
      <path d="M12 9v5M12 17h.01" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  qr: (
    <>
      <rect x="3" y="3" width="6" height="6" />
      <rect x="15" y="3" width="6" height="6" />
      <rect x="3" y="15" width="6" height="6" />
      <path d="M15 15h2v2h-2zM19 15h2v6h-6v-2M15 21h.01" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 12l9 5 9-5M3 16l9 5 9-5" />
    </>
  ),
  map: (
    <>
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M17 6l3 3M14 9l2 2" />
    </>
  ),
  scan: <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10" />,
};

export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  strokeWidth = 2.2,
  color = 'currentColor',
  style,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
};
