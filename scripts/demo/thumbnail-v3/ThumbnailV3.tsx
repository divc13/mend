import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Sam } from '../../../demo/ad/src/characters/Sam';
import { Logo } from '../../../demo/ad/src/components/Logo';
import { Pothole } from '../../../demo/ad/src/v2/components/PaperCast';
import { fonts, palette } from '../../../demo/ad/src/theme';

const PAPER_NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)' opacity='0.32'/%3E%3C/svg%3E\")";

const TORN_PANEL =
  'polygon(2.4% 2.1%, 21% 0.4%, 46% 1.8%, 72% 0.2%, 97% 2.6%, 99.1% 19%, 98.2% 41%, 99.4% 63%, 98.1% 86%, 96.4% 98.1%, 73% 99.2%, 49% 98.4%, 24% 99.5%, 2.1% 97.6%, 0.6% 79%, 1.5% 57%, 0.3% 34%, 1.7% 15%)';

const Pill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 13,
      height: 58,
      padding: '0 24px 0 20px',
      borderRadius: 999,
      backgroundColor: palette.greenDark,
      color: palette.paper,
      boxShadow: '0 10px 24px rgba(7,27,21,0.22)',
      fontFamily: fonts.mono,
      fontSize: 21,
      fontWeight: 600,
      letterSpacing: '0.12em',
      whiteSpace: 'nowrap',
    }}
  >
    <span
      style={{
        width: 11,
        height: 11,
        borderRadius: 999,
        backgroundColor: palette.mint,
        boxShadow: `0 0 0 4px rgba(143,211,180,0.18)`,
      }}
    />
    {children}
  </div>
);

const PaperTag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      height: 32,
      padding: '0 12px',
      backgroundColor: palette.amberSoft,
      border: `1px solid ${palette.lineStrong}`,
      boxShadow: '3px 4px 0 rgba(17,34,29,0.08)',
      fontFamily: fonts.mono,
      fontSize: 13,
      letterSpacing: '0.16em',
      color: palette.amberStrong,
      textTransform: 'uppercase',
    }}
  >
    {children}
  </div>
);

export const ThumbnailV3: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.paper,
        overflow: 'hidden',
        backgroundImage: [
          'radial-gradient(1050px 860px at 79% 39%, rgba(143,211,180,0.30), transparent 64%)',
          'radial-gradient(900px 720px at 8% 96%, rgba(169,103,18,0.12), transparent 62%)',
          'linear-gradient(128deg, #f8f4e9 0%, #f1ead9 56%, #e9e1cf 100%)',
        ].join(','),
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: PAPER_NOISE,
          opacity: 0.16,
          mixBlendMode: 'multiply',
          pointerEvents: 'none',
        }}
      />

      {/* Fine paper grid, kept very quiet so the frame does not read as app UI. */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(17,34,29,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(17,34,29,0.045) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
          maskImage:
            'radial-gradient(ellipse at 22% 40%, black 0%, transparent 67%)',
          opacity: 0.72,
          pointerEvents: 'none',
        }}
      />

      {/* Top-left brand */}
      <div style={{ position: 'absolute', left: 92, top: 72 }}>
        <Logo size={62} tone="paper" />
      </div>

      {/* Small mode reminder, deliberately a caption not a dashboard. */}
      <div
        style={{
          position: 'absolute',
          right: 92,
          top: 88,
          fontFamily: fonts.mono,
          fontSize: 14,
          letterSpacing: '0.18em',
          color: palette.muted,
          textTransform: 'uppercase',
        }}
      >
        Maintenance with memory
      </div>

      {/* Left column */}
      <div
        style={{
          position: 'absolute',
          left: 96,
          top: 208,
          width: 1030,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontFamily: fonts.mono,
            fontSize: 19,
            fontWeight: 600,
            letterSpacing: '0.19em',
            color: palette.amberStrong,
            textTransform: 'uppercase',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 46,
              height: 4,
              backgroundColor: palette.amber,
            }}
          />
          Report. Repair. Remember.
        </div>

        <div
          style={{
            marginTop: 30,
            fontFamily: fonts.display,
            fontWeight: 600,
            fontSize: 118,
            lineHeight: 0.9,
            letterSpacing: '-0.035em',
            color: palette.ink,
            textTransform: 'uppercase',
          }}
        >
          <div>Get it fixed.</div>
          <div style={{ color: palette.green }}>Keep it fixed.</div>
        </div>

        <div
          style={{
            marginTop: 28,
            width: 660,
            fontFamily: fonts.body,
            fontSize: 31,
            lineHeight: 1.35,
            color: palette.inkSoft,
          }}
        >
          One work order. One passport. One receipt.
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            marginTop: 38,
          }}
        >
          <Pill>42 TX VERIFIED</Pill>
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: 14,
              lineHeight: 1.4,
              letterSpacing: '0.12em',
              color: palette.muted,
              textTransform: 'uppercase',
            }}
          >
            Real testnet rails
            <br />
            Replay pothole story
          </div>
        </div>
      </div>

      {/* Right-side paper-cut diorama */}
      <div
        style={{
          position: 'absolute',
          right: 76,
          top: 118,
          width: 704,
          height: 852,
          filter: 'drop-shadow(18px 26px 0 rgba(17,34,29,0.10))',
          transform: 'rotate(1.15deg)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            clipPath: TORN_PANEL,
            backgroundColor: palette.mintSoft,
            backgroundImage: [
              'radial-gradient(500px 420px at 52% 36%, rgba(255,253,248,0.92), rgba(255,253,248,0) 70%)',
              'linear-gradient(158deg, rgba(255,253,248,0.72), rgba(220,238,228,0.45))',
            ].join(','),
          }}
        />

        {/* A quieter, hand-cut interior layer */}
        <div
          style={{
            position: 'absolute',
            left: 40,
            top: 38,
            right: 40,
            bottom: 38,
            border: `1.5px dashed rgba(14,74,57,0.28)`,
          }}
        />

        <div style={{ position: 'absolute', left: 46, top: 44 }}>
          <PaperTag>The street / paper cut</PaperTag>
        </div>

        <div
          style={{
            position: 'absolute',
            right: 42,
            top: 42,
            fontFamily: fonts.mono,
            fontSize: 12,
            letterSpacing: '0.14em',
            color: palette.green,
            opacity: 0.72,
            textAlign: 'right',
            lineHeight: 1.55,
          }}
        >
          RIVERSIDE PATH
          <br />
          NORTH GATE
        </div>

        {/* Orbit lines echo the film's paper-map language. */}
        <svg
          viewBox="0 0 704 852"
          width={704}
          height={852}
          style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
          aria-hidden="true"
        >
          <g fill="none" stroke={palette.green} opacity={0.16}>
            <ellipse cx={352} cy={352} rx={264} ry={252} strokeWidth={1.4} />
            <ellipse cx={352} cy={352} rx={196} ry={186} strokeWidth={1.2} />
            <path d="M92 690 C 220 618, 470 620, 626 706" strokeWidth={2} strokeDasharray="7 12" />
          </g>
          <path
            d="M108 744 l38 -20 M566 736 l40 14 M188 190 l-20 30 M548 212 l26 24"
            stroke={palette.amber}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.62}
          />
        </svg>

        {/* Paper ground strip, then the cut road plate and Sam. */}
        <div
          style={{
            position: 'absolute',
            left: 22,
            right: 22,
            bottom: 86,
            height: 90,
            backgroundColor: palette.paperDeep,
            clipPath:
              'polygon(0.6% 8%, 14% 1%, 33% 6%, 52% 1.5%, 72% 5%, 89% 1%, 99.4% 7%, 98.6% 92%, 82% 99%, 61% 94%, 40% 99%, 19% 95%, 1.2% 99%)',
            boxShadow: '0 12px 0 rgba(17,34,29,0.06)',
          }}
        />

        <div
          style={{
            position: 'absolute',
            left: 42,
            bottom: 118,
            width: 471,
            height: 198,
            transform: 'rotate(-1.3deg)',
          }}
        >
          <Pothole variant="open" scale={0.62} label="Open pothole" style={{ left: 0, top: 0 }} />
        </div>

        <div
          style={{
            position: 'absolute',
            right: 8,
            bottom: 112,
            width: 282,
            height: 536,
            transform: 'rotate(-1.2deg)',
          }}
        >
          <Sam
            pose="take-photo"
            width={282}
            height={536}
            frame={16}
            fps={30}
            animated={false}
            flash={false}
            flip
          />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 48,
            bottom: 344,
            fontFamily: fonts.mono,
            fontSize: 12,
            letterSpacing: '0.15em',
            color: palette.muted,
            textTransform: 'uppercase',
          }}
        >
          Sam · pothole · report
        </div>
      </div>

      {/* Footer honesty line, not a second proof unit. */}
      <div
        style={{
          position: 'absolute',
          left: 96,
          bottom: 52,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: fonts.mono,
          fontSize: 13,
          letterSpacing: '0.15em',
          color: palette.muted,
          textTransform: 'uppercase',
        }}
      >
        <span style={{ color: palette.amber }}>●</span>
        Replay story · Real testnet rails · No live funds in the replay
      </div>

      <div
        style={{
          position: 'absolute',
          right: 96,
          bottom: 52,
          fontFamily: fonts.display,
          fontSize: 30,
          letterSpacing: '0.08em',
          color: palette.green,
          textTransform: 'uppercase',
        }}
      >
        Mend
      </div>
    </AbsoluteFill>
  );
};
