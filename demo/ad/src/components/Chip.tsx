import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { fonts, palette } from '../theme';

export type ChipTone = 'paper' | 'green' | 'mint' | 'amber' | 'red' | 'ghost' | 'dark';

type ChipProps = {
  children: ReactNode;
  icon?: IconName;
  tone?: ChipTone;
  size?: 'sm' | 'md' | 'lg';
  uppercase?: boolean;
  style?: CSSProperties;
};

const toneStyles: Record<ChipTone, CSSProperties> = {
  paper: {
    backgroundColor: palette.surface,
    borderColor: palette.line,
    color: palette.ink,
  },
  green: {
    backgroundColor: palette.green,
    borderColor: palette.green,
    color: palette.paper,
  },
  mint: {
    backgroundColor: palette.mintSoft,
    borderColor: palette.mint,
    color: palette.green,
  },
  amber: {
    backgroundColor: palette.amberSoft,
    borderColor: 'rgba(169, 103, 18, 0.35)',
    color: palette.amberStrong,
  },
  red: {
    backgroundColor: palette.redSoft,
    borderColor: 'rgba(159, 54, 44, 0.28)',
    color: palette.red,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: palette.line,
    color: palette.inkSoft,
  },
  dark: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    color: palette.paper,
  },
};

const sizeStyles = {
  sm: { fontSize: 15, padding: '6px 12px', gap: 7, icon: 15 },
  md: { fontSize: 18, padding: '9px 16px', gap: 9, icon: 18 },
  lg: { fontSize: 22, padding: '12px 20px', gap: 11, icon: 22 },
} as const;

export const Chip: React.FC<ChipProps> = ({
  children,
  icon,
  tone = 'paper',
  size = 'md',
  uppercase = true,
  style,
}) => {
  const sizing = sizeStyles[size];
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sizing.gap,
        padding: sizing.padding,
        borderRadius: 999,
        border: '1px solid',
        fontFamily: fonts.body,
        fontSize: sizing.fontSize,
        fontWeight: 600,
        lineHeight: 1.1,
        letterSpacing: uppercase ? '0.11em' : '-0.01em',
        textTransform: uppercase ? 'uppercase' : 'none',
        whiteSpace: 'nowrap',
        ...toneStyles[tone],
        ...style,
      }}
    >
      {icon ? <Icon name={icon} size={sizing.icon} strokeWidth={2.4} /> : null}
      <span>{children}</span>
    </div>
  );
};
