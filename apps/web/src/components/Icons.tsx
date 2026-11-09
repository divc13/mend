import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function BrandMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="40" height="40" rx="12" fill="var(--brand-mark-bg, #0e4a39)" />
      <path
        d="M11 27V15.5c0-1.1.9-2 2-2h1.2c.6 0 1.1.3 1.5.8L20 19l4.3-4.7c.4-.5.9-.8 1.5-.8H27c1.1 0 2 .9 2 2V27"
        stroke="#f8f4e8"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M14.5 24.5c1.7 1.2 3.5 1.8 5.5 1.8s3.8-.6 5.5-1.8"
        stroke="#8fd3b4"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        strokeDasharray="1 4"
      />
    </svg>
  );
}

export const MapPin = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 10c0 5.5-8 12-8 12S4 15.5 4 10a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Icon>
);

export const ShieldCheck = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3 5 6v5.5c0 4.7 3 8.2 7 9.5 4-1.3 7-4.8 7-9.5V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);

export const FileText = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Icon>
);

export const Hammer = (props: IconProps) => (
  <Icon {...props}>
    <path d="m14 7 3-3 4 4-3 3" />
    <path d="m11 10 3 3" />
    <path d="m4 20 7-7" />
    <path d="M14 4h3v3" />
  </Icon>
);

export const Eye = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const Lock = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4.5" y="10" width="15" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" />
  </Icon>
);

export const ArrowRight = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 12h15M14 6l6 6-6 6" />
  </Icon>
);

export const ArrowUpRight = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7 17 17 7M8 7h9v9" />
  </Icon>
);

export const Check = (props: IconProps) => (
  <Icon {...props}>
    <path d="m4 12.5 5 5L20 6.5" />
  </Icon>
);

export const X = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const Clock = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);

export const AlertTriangle = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.5L13.7 4.2a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 16.5h.01" />
  </Icon>
);

export const Camera = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
);

export const Sparkles = (props: IconProps) => (
  <Icon {...props}>
    <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" />
    <path d="M19 15.5 20 18l2.5 1-2.5 1-1 2.5-1-2.5L15.5 19l2.5-1 1-2.5Z" />
    <path d="M5 15.5 6 18l2.5 1L6 20l-1 2.5L4 20l-2.5-1L4 18l1-2.5Z" />
  </Icon>
);

export const Wallet = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="6" width="17" height="13" rx="2.5" />
    <path d="M3.5 9.5h17M16 14.5h1.5" />
  </Icon>
);

export const ExternalLink = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Icon>
);

export const Menu = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const ChevronDown = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const Copy = (props: IconProps) => (
  <Icon {...props}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Icon>
);

export const Scale = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 4v16M7 20h10M5 8h14M5 8l-2.5 6a3 3 0 0 0 5 0L5 8ZM19 8l-2.5 6a3 3 0 0 0 5 0L19 8Z" />
  </Icon>
);

export const Refresh = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 6v5h-5" />
    <path d="M19 11a7.5 7.5 0 1 0-1.5 5.5" />
  </Icon>
);

export const Play = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 5.5 19 12 8 18.5v-13Z" />
  </Icon>
);

export const SkipForward = (props: IconProps) => (
  <Icon {...props}>
    <path d="m5 5.5 9 6.5-9 6.5v-13ZM19 5v14" />
  </Icon>
);

export const Search = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Icon>
);

export const Info = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </Icon>
);

export const Coins = (props: IconProps) => (
  <Icon {...props}>
    <ellipse cx="9" cy="7" rx="5.5" ry="2.5" />
    <path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7" />
    <path d="M8.5 13.5V17c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4" />
    <ellipse cx="14" cy="13" rx="5.5" ry="2.5" />
  </Icon>
);

export const NodeTree = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="5" r="2.5" />
    <circle cx="5.5" cy="19" r="2.5" />
    <circle cx="18.5" cy="19" r="2.5" />
    <path d="M12 7.5v4M5.5 16.5v-2a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v2" />
  </Icon>
);

export const ImageIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4.5 17 5-5 4 4 3-3 3 3" />
  </Icon>
);

export const Gavel = (props: IconProps) => (
  <Icon {...props}>
    <path d="m13 5 6 6M9 9l6 6M10.5 7.5 7 11l6 6 3.5-3.5" />
    <path d="M3 21h9M5 21l4.5-4.5" />
  </Icon>
);

export const Users = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M15.5 5.5a3 3 0 0 1 0 5.8M16 13.5a5.5 5.5 0 0 1 4.5 5.5" />
  </Icon>
);
