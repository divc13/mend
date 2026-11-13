import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Img, Loop, OffthreadVideo, interpolate, useCurrentFrame } from 'remotion';
import { CLAMP } from '../../motion';
import { fonts, palette } from '../../theme';
import { appMedia, footageMedia, liveMedia, type MediaAsset } from '../lib/assets';
import type { SceneId } from '../lib/script';

type MediaPanelProps = {
  asset: MediaAsset | null;
  label: string;
  placeholder: string;
  tone?: 'paper' | 'dark';
  style?: CSSProperties;
  children?: ReactNode;
  loopFrames?: number;
  chrome?: boolean;
  objectFit?: CSSProperties['objectFit'];
  inset?: number;
  rounded?: number;
  fallback?: ReactNode;
};

const BrowserChrome: React.FC<{ label: string; tone: 'paper' | 'dark' }> = ({
  label,
  tone,
}) => {
  const dark = tone === 'dark';
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 38,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 14px',
        backgroundColor: dark ? 'rgba(7, 27, 21, 0.9)' : 'rgba(245, 241, 230, 0.95)',
        borderBottom: `1px solid ${dark ? 'rgba(143, 211, 180, 0.22)' : palette.line}`,
        zIndex: 4,
      }}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            backgroundColor: dark ? 'rgba(245, 241, 230, 0.28)' : 'rgba(17, 34, 29, 0.22)',
          }}
        />
      ))}
      <span
        style={{
          marginLeft: 10,
          fontFamily: fonts.mono,
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: dark ? 'rgba(245, 241, 230, 0.55)' : palette.muted,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </span>
    </div>
  );
};

const Placeholder: React.FC<{
  label: string;
  placeholder: string;
  tone: 'paper' | 'dark';
}> = ({ label, placeholder, tone }) => {
  const frame = useCurrentFrame();
  const dark = tone === 'dark';
  const offset = (frame * 0.8) % 64;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        backgroundColor: dark ? '#0b241c' : palette.surfaceSoft,
        backgroundImage: `repeating-linear-gradient(135deg, ${
          dark ? 'rgba(143, 211, 180, 0.10)' : 'rgba(14, 74, 57, 0.07)'
        } 0 18px, transparent 18px 36px)`,
        backgroundPosition: `${offset}px ${offset}px`,
        color: dark ? palette.paper : palette.ink,
      }}
    >
      <div
        style={{
          width: 74,
          height: 74,
          borderRadius: 22,
          border: `1.5px dashed ${dark ? 'rgba(143, 211, 180, 0.5)' : 'rgba(14, 74, 57, 0.35)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: dark ? 'rgba(143, 211, 180, 0.08)' : 'rgba(14, 74, 57, 0.05)',
        }}
      >
        <svg width="38" height="38" viewBox="0 0 38 38" fill="none" aria-hidden="true">
          <rect x="4" y="7" width="30" height="24" rx="4" stroke={dark ? palette.mint : palette.green} strokeWidth="2" />
          <path d="M4 13h30" stroke={dark ? palette.mint : palette.green} strokeWidth="2" opacity="0.6" />
          <circle cx="9" cy="10" r="1.4" fill={dark ? palette.mint : palette.green} />
          <path d="M12 25l5-6 4 4 3-3 4 5" stroke={dark ? palette.mint : palette.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: 34,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          textAlign: 'center',
          maxWidth: '80%',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          opacity: 0.6,
        }}
      >
        {placeholder}
      </div>
    </div>
  );
};

export const MediaPanel: React.FC<MediaPanelProps> = ({
  asset,
  label,
  placeholder,
  tone = 'paper',
  style,
  children,
  loopFrames = 240,
  chrome = true,
  objectFit = 'cover',
  inset = 0,
  rounded = 22,
  fallback,
}) => {
  const frame = useCurrentFrame();
  const dark = tone === 'dark';
  const zoom = interpolate(frame, [0, Math.max(1, loopFrames)], [1.015, 1.06], CLAMP);
  return (
    <div
      style={{
        position: 'absolute',
        overflow: 'hidden',
        borderRadius: rounded,
        border: `1px solid ${dark ? 'rgba(143, 211, 180, 0.24)' : palette.line}`,
        backgroundColor: dark ? '#0a2019' : palette.surface,
        boxShadow: dark
          ? '0 34px 90px rgba(0, 0, 0, 0.42)'
          : '0 30px 80px rgba(17, 34, 29, 0.16)',
        ...style,
      }}
    >
      {asset ? (
        asset.kind === 'video' ? (
          <div style={{ position: 'absolute', inset, transform: `scale(${zoom})` }}>
            <Loop durationInFrames={Math.max(1, loopFrames)}>
              <OffthreadVideo
                src={asset.src}
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit,
                  display: 'block',
                }}
              />
            </Loop>
          </div>
        ) : (
          <Img
            src={asset.src}
            style={{
              position: 'absolute',
              inset,
              width: '100%',
              height: '100%',
              objectFit,
              transform: `scale(${zoom})`,
              display: 'block',
            }}
          />
        )
      ) : (
        fallback ?? <Placeholder label={label} placeholder={placeholder} tone={tone} />
      )}
      {chrome ? <BrowserChrome label={label} tone={tone} /> : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, rgba(7, 20, 16, 0.08) 0%, transparent 22%, transparent 72%, rgba(7, 20, 16, 0.22) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.12,
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.35) 0 1px, transparent 1px 4px)',
          mixBlendMode: 'overlay',
        }}
      />
      {children}
    </div>
  );
};

type LiveCaptureProps = Omit<MediaPanelProps, 'asset' | 'placeholder'> & {
  sceneId: SceneId;
  placeholder?: string;
};

export const LiveCapture: React.FC<LiveCaptureProps> = ({
  sceneId,
  label,
  placeholder = 'LIVE APP CAPTURE PENDING',
  ...rest
}) => (
  <MediaPanel
    asset={liveMedia(sceneId)}
    label={label}
    placeholder={placeholder}
    {...rest}
  />
);

type FootageProps = Omit<MediaPanelProps, 'asset' | 'placeholder' | 'label'> & {
  name: string;
  label?: string;
  placeholder?: string;
};

export const Footage: React.FC<FootageProps> = ({
  name,
  label = name,
  placeholder = 'FOOTAGE PENDING',
  ...rest
}) => (
  <MediaPanel
    asset={footageMedia(name)}
    label={label}
    placeholder={placeholder}
    {...rest}
  />
);

type AppStillProps = Omit<MediaPanelProps, 'asset' | 'placeholder'> & {
  name: string;
  placeholder?: string;
};

export const AppStill: React.FC<AppStillProps> = ({
  name,
  label,
  placeholder = 'APP SCREEN PENDING',
  ...rest
}) => (
  <MediaPanel
    asset={appMedia(name)}
    label={label}
    placeholder={placeholder}
    {...rest}
  />
);

export const MediaBadge: React.FC<{
  children: ReactNode;
  tone?: 'paper' | 'dark';
  style?: CSSProperties;
}> = ({ children, tone = 'dark', style }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '7px 12px',
      borderRadius: 999,
      backgroundColor: tone === 'dark' ? 'rgba(7, 27, 21, 0.72)' : 'rgba(255, 253, 248, 0.9)',
      border: `1px solid ${tone === 'dark' ? 'rgba(143, 211, 180, 0.3)' : palette.line}`,
      color: tone === 'dark' ? palette.mint : palette.green,
      fontFamily: fonts.mono,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      backdropFilter: 'blur(8px)',
      ...style,
    }}
  >
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: 999,
        backgroundColor: tone === 'dark' ? palette.mint : palette.green,
        boxShadow: `0 0 10px ${tone === 'dark' ? palette.mint : palette.green}`,
      }}
    />
    {children}
  </div>
);
