import React from 'react';
import type { CSSProperties } from 'react';
import { useCurrentFrame } from 'remotion';
import { fadeIn, popIn, riseIn } from '../motion';
import { Chip } from './Chip';
import { Logo } from './Logo';
import { fonts, palette } from '../theme';

type EndCardProps = {
  caption: string;
  siteUrl: string;
  disclosures: string[];
  steps?: string[];
  style?: CSSProperties;
};

const hash = (index: number): number => {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const QRPlaceholder: React.FC = () => {
  const frame = useCurrentFrame();
  const size = 21;
  const cells: React.ReactNode[] = [];
  const finder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const border = x === 0 || x === 6 || y === 0 || y === 6;
        const center = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        if (border || center) {
          cells.push(
            <rect
              key={`f-${ox}-${oy}-${x}-${y}`}
              x={ox + x}
              y={oy + y}
              width={1}
              height={1}
              fill={palette.ink}
            />,
          );
        }
      }
    }
  };
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const inFinder =
        (x < 7 && y < 7) ||
        (x >= size - 7 && y < 7) ||
        (x < 7 && y >= size - 7);
      if (!inFinder && hash(x * 31 + y * 17 + 7) > 0.5) {
        cells.push(
          <rect
            key={`c-${x}-${y}`}
            x={x}
            y={y}
            width={1}
            height={1}
            fill={palette.ink}
          />,
        );
      }
    }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          position: 'relative',
          width: 150,
          height: 150,
          padding: 10,
          borderRadius: 16,
          backgroundColor: palette.surface,
          border: `1px solid ${palette.line}`,
          boxShadow: '0 14px 36px rgba(17, 34, 29, 0.12)',
          overflow: 'hidden',
        }}
      >
        <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <rect width={size} height={size} fill={palette.surface} />
          {cells}
        </svg>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${((frame * 1.2) % 160) - 10}px`,
            height: 2,
            backgroundColor: palette.mint,
            opacity: 0.7,
            boxShadow: `0 0 12px ${palette.mint}`,
          }}
        />
      </div>
      <span
        style={{
          fontFamily: fonts.mono,
          fontSize: 11,
          letterSpacing: '0.16em',
          color: palette.muted,
        }}
      >
        QR PLACEHOLDER
      </span>
    </div>
  );
};

export const EndCard: React.FC<EndCardProps> = ({
  caption,
  siteUrl,
  disclosures,
  steps = [],
  style,
}) => {
  const frame = useCurrentFrame();
  const logo = popIn(frame, 30, 4, 180, 90);
  const kicker = fadeIn(frame, 20, 22);
  const stepsIn = riseIn(frame, 40, 26, 20);
  const linkIn = riseIn(frame, 62, 26, 24);
  const captionIn = riseIn(frame, 82, 28, 24);
  const disclosureIn = fadeIn(frame, 100, 24);
  const lines = caption.split('\n').filter((line) => line.trim().length > 0);
  const hasUrl = siteUrl.trim().length > 0;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '104px 120px 38px',
        ...style,
      }}
    >
      <div style={{ opacity: logo, transform: `scale(${0.9 + logo * 0.1})` }}>
        <Logo size={104} tone="paper" />
      </div>
      <div
        style={{
          marginTop: 18,
          fontFamily: fonts.mono,
          fontSize: 17,
          letterSpacing: '0.2em',
          color: palette.amber,
          opacity: kicker,
        }}
      >
        A COMMUNITY REPAIR PROTOCOL
      </div>

      {steps.length > 0 ? (
        <div
          style={{
            marginTop: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            opacity: stepsIn.opacity,
            transform: stepsIn.transform,
          }}
        >
          {steps.map((step, index) => (
            <React.Fragment key={step}>
              <Chip tone={index === 0 ? 'green' : 'paper'} size="md" icon="check">
                {step}
              </Chip>
              {index < steps.length - 1 ? (
                <div
                  style={{
                    width: 26,
                    height: 1,
                    backgroundColor: palette.lineStrong,
                  }}
                />
              ) : null}
            </React.Fragment>
          ))}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 34,
          opacity: linkIn.opacity,
          transform: linkIn.transform,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 13,
              letterSpacing: '0.16em',
              color: palette.muted,
            }}
          >
            {hasUrl ? 'FINAL LINK' : 'FINAL LINK PENDING'}
          </span>
          <div
            style={{
              padding: '14px 24px',
              borderRadius: 999,
              border: `1.5px dashed ${hasUrl ? palette.green : palette.amber}`,
              backgroundColor: hasUrl ? palette.mintSoft : palette.amberSoft,
              color: hasUrl ? palette.green : palette.amberStrong,
              fontFamily: fonts.mono,
              fontSize: hasUrl ? 22 : 24,
              fontWeight: 600,
              letterSpacing: '0.06em',
            }}
          >
            {hasUrl ? siteUrl : 'DEMO LINK IN DESCRIPTION'}
          </div>
          <span
            style={{
              fontFamily: fonts.body,
              fontSize: 15,
              color: palette.muted,
            }}
          >
            {hasUrl ? 'Scan or type the link.' : 'Placeholder until the final URL is set.'}
          </span>
        </div>
        <QRPlaceholder />
      </div>

      <div
        style={{
          marginTop: 34,
          textAlign: 'center',
          opacity: captionIn.opacity,
          transform: captionIn.transform,
        }}
      >
        {lines.map((line, index) => (
          <div
            key={`${line}-${index}`}
            style={{
              fontFamily: index === 0 ? fonts.display : fonts.body,
              fontSize: index === 0 ? 38 : 58,
              fontWeight: index === 0 ? 500 : 650,
              lineHeight: 1.1,
              letterSpacing: index === 0 ? '-0.01em' : '-0.025em',
              color: index === 0 ? palette.muted : palette.ink,
            }}
          >
            {line}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 'auto',
          maxWidth: 1480,
          textAlign: 'center',
          opacity: disclosureIn,
        }}
      >
        {disclosures.map((line) => (
          <div
            key={line}
            style={{
              fontFamily: fonts.body,
              fontSize: 15,
              lineHeight: 1.5,
              color: palette.muted,
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
};
