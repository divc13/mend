import type { CSSProperties } from 'react';

export const palette = {
  paper: '#f5f1e6',
  paperDeep: '#e9e2d2',
  paperLine: '#d9d1bf',
  surface: '#fffdf8',
  surfaceSoft: '#faf7ee',
  ink: '#11221d',
  inkSoft: '#33473f',
  muted: '#5b6b65',
  mutedLight: '#7d8a84',
  line: '#d9d1bf',
  lineStrong: '#bfb49a',
  green: '#0e4a39',
  greenDeep: '#09372a',
  greenDark: '#071b15',
  green600: '#12614a',
  green100: '#dceee4',
  mint: '#8fd3b4',
  mintSoft: '#e6f4ec',
  amber: '#a96712',
  amberStrong: '#8a5209',
  amberSoft: '#faeed5',
  red: '#9f362c',
  redSoft: '#f8e3df',
  blue: '#2f5c85',
  blueSoft: '#e4edf6',
  white: '#ffffff',
} as const;

export const fonts = {
  display:
    '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif',
  body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 34,
  pill: 999,
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(17, 34, 29, 0.06), 0 6px 18px rgba(17, 34, 29, 0.04)',
  md: '0 2px 4px rgba(17, 34, 29, 0.06), 0 18px 48px rgba(17, 34, 29, 0.09)',
  lg: '0 30px 90px rgba(17, 34, 29, 0.16)',
  dark: '0 30px 90px rgba(0, 0, 0, 0.4)',
} as const;

export const safe = {
  top: 64,
  bottom: 54,
  left: 96,
  right: 96,
} as const;

export const textStyles = {
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 19,
    fontWeight: 500,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
  } satisfies CSSProperties,
  body: {
    fontFamily: fonts.body,
    fontSize: 28,
    lineHeight: 1.45,
    fontWeight: 400,
  } satisfies CSSProperties,
  display: {
    fontFamily: fonts.display,
    fontWeight: 600,
    letterSpacing: '-0.025em',
    lineHeight: 0.98,
  } satisfies CSSProperties,
} as const;
