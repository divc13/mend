import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { fonts, palette, shadows } from '../theme';
import { Sam } from './Sam';
import type { SamPose } from './Sam';
import { StickFigure } from './StickFigure';
import { Neighbor } from './Neighbor';
import { Contractor } from './Contractor';
import { Inspector } from './Inspector';
import { CouncilTable } from './CouncilTable';
import { BidderRow } from './BidderRow';

const SectionHeader: React.FC<{
  title: string;
  note: string;
  style?: CSSProperties;
}> = ({ title, note, style }) => (
  <div
    style={{
      position: 'absolute',
      left: 24,
      right: 24,
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 12,
      ...style,
    }}
  >
    <span
      style={{
        fontFamily: fonts.mono,
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: palette.green,
        whiteSpace: 'nowrap',
      }}
    >
      {title}
    </span>
    <span
      style={{
        fontFamily: fonts.mono,
        fontSize: 9.5,
        letterSpacing: '0.08em',
        color: palette.muted,
        textAlign: 'right',
      }}
    >
      {note}
    </span>
  </div>
);

const GalleryPhoneScreen: React.FC<{ mode?: 'report' | 'case' }> = ({
  mode = 'report',
}) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      padding: 4,
      background: palette.mint,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: fonts.body,
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 8,
        marginBottom: 3,
      }}
    >
      <div
        style={{
          width: 16,
          height: 3,
          borderRadius: 2,
          background: palette.ink,
        }}
      />
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: 3,
          background: mode === 'case' ? palette.amber : palette.green,
        }}
      />
    </div>
    <div
      style={{
        flex: 1,
        minHeight: 0,
        background: palette.surface,
        borderRadius: 4,
        padding: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      <div
        style={{
          width: '72%',
          height: 3,
          borderRadius: 2,
          background: palette.green,
        }}
      />
      <div
        style={{
          width: '48%',
          height: 2,
          borderRadius: 1,
          background: palette.lineStrong,
        }}
      />
      <div
        style={{
          marginTop: 2,
          height: 22,
          borderRadius: 3,
          background: palette.mintSoft,
          border: `1px solid ${palette.mint}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 9,
            height: 9,
            borderRadius: 5,
            background: mode === 'case' ? palette.amber : palette.green,
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        <div
          style={{
            flex: 1,
            height: 7,
            borderRadius: 2,
            background: palette.paperDeep,
          }}
        />
        <div
          style={{
            flex: 1,
            height: 7,
            borderRadius: 2,
            background: palette.paperDeep,
          }}
        />
      </div>
      <div
        style={{
          marginTop: 'auto',
          height: 8,
          borderRadius: 2,
          background: palette.green,
        }}
      />
    </div>
  </div>
);

const SamCell: React.FC<{
  index: string;
  pose: SamPose;
  title: string;
  note: string;
  progress?: number;
  flash?: boolean;
  phoneScreen?: ReactNode;
  frame: number;
}> = ({ index, pose, title, note, progress, flash, phoneScreen, frame }) => (
  <div
    style={{
      position: 'relative',
      height: 374,
      borderRadius: 18,
      border: `1px solid ${palette.line}`,
      background:
        'linear-gradient(180deg, rgba(255, 253, 248, 0.82), rgba(250, 247, 238, 0.94))',
      overflow: 'hidden',
    }}
  >
    <span
      style={{
        position: 'absolute',
        top: 10,
        left: 12,
        fontFamily: fonts.mono,
        fontSize: 10,
        letterSpacing: '0.12em',
        color: palette.amber,
      }}
    >
      {index}
    </span>
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 10,
        bottom: 56,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <Sam
        pose={pose}
        width={163}
        height={310}
        frame={frame}
        progress={progress}
        flash={flash}
        phoneScreen={phoneScreen}
        enterAt={0}
      />
    </div>
    <div
      style={{
        position: 'absolute',
        left: 28,
        right: 28,
        bottom: 56,
        height: 1,
        background: palette.line,
        opacity: 0.8,
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: 10,
        right: 10,
        bottom: 9,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: fonts.body,
          fontSize: 15,
          fontWeight: 650,
          color: palette.ink,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: 2,
          fontFamily: fonts.mono,
          fontSize: 9.5,
          letterSpacing: '0.04em',
          color: palette.muted,
        }}
      >
        {note}
      </div>
    </div>
  </div>
);

const CastCell: React.FC<{
  label: string;
  color: string;
  children: ReactNode;
}> = ({ label, color, children }) => (
  <div
    style={{
      height: 136,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
    }}
  >
    <div
      style={{
        height: 110,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      {children}
    </div>
    <div
      style={{
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: 3,
          background: color,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: fonts.mono,
          fontSize: 9,
          letterSpacing: '0.06em',
          color: palette.inkSoft,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  </div>
);

export const CharacterGallery: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: palette.paper, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          backgroundImage: [
            'radial-gradient(1050px 720px at 7% -6%, rgba(143, 211, 180, 0.30), transparent 62%)',
            'radial-gradient(900px 620px at 96% 6%, rgba(169, 103, 18, 0.12), transparent 58%)',
            'linear-gradient(180deg, #f8f4ea 0%, #f1ebdd 100%)',
          ].join(', '),
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.035,
          backgroundImage:
            'linear-gradient(rgba(17, 34, 29, 0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(17, 34, 29, 0.9) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
        }}
      />
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', inset: 0, opacity: 0.06 }}
        aria-hidden="true"
      >
        <g fill="none" stroke={palette.green} strokeWidth="1.4">
          <ellipse cx="1690" cy="190" rx="440" ry="280" />
          <ellipse cx="1690" cy="190" rx="350" ry="220" />
          <ellipse cx="1690" cy="190" rx="260" ry="160" />
          <ellipse cx="240" cy="980" rx="430" ry="240" />
          <ellipse cx="240" cy="980" rx="330" ry="182" />
        </g>
      </svg>

      {/* Header */}
      <div
        style={{
          position: 'absolute',
          left: 64,
          top: 38,
          fontFamily: fonts.mono,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: palette.amber,
        }}
      >
        MEND · CHARACTER SYSTEM / V2
      </div>
      <div
        style={{
          position: 'absolute',
          left: 64,
          top: 62,
          fontFamily: fonts.display,
          fontSize: 50,
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: '-0.025em',
          color: palette.ink,
        }}
      >
        The cast, on paper.
      </div>
      <div
        style={{
          position: 'absolute',
          left: 66,
          top: 122,
          fontFamily: fonts.body,
          fontSize: 17,
          lineHeight: 1.35,
          color: palette.muted,
        }}
      >
        A layered paper-cut protagonist, an ink-line supporting cast, and two
        decision set-pieces.
      </div>

      <div
        style={{
          position: 'absolute',
          right: 64,
          top: 40,
          textAlign: 'right',
          fontFamily: fonts.mono,
          fontSize: 10.5,
          letterSpacing: '0.08em',
          color: palette.muted,
        }}
      >
        1920 × 1080 · 30 FPS · {durationInFrames} FRAMES
      </div>
      <div
        style={{
          position: 'absolute',
          right: 64,
          top: 60,
          textAlign: 'right',
          fontFamily: fonts.mono,
          fontSize: 10.5,
          letterSpacing: '0.08em',
          color: palette.amber,
        }}
      >
        FRAME {String(frame).padStart(3, '0')} / {durationInFrames}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 64,
          top: 104,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 14,
        }}
      >
        {[
          ['PAPER', palette.paper],
          ['INK', palette.ink],
          ['MINT', palette.mint],
          ['AMBER', palette.amber],
        ].map(([label, color]) => (
          <div
            key={label}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: color,
                border: `1px solid ${palette.ink}`,
              }}
            />
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 9,
                letterSpacing: '0.08em',
                color: palette.muted,
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 64,
          right: 64,
          top: 156,
          height: 1,
          background: palette.lineStrong,
          opacity: 0.65,
        }}
      />

      {/* Left panel — Sam */}
      <div
        style={{
          position: 'absolute',
          left: 64,
          top: 180,
          width: 1136,
          height: 852,
          borderRadius: 28,
          border: `1px solid ${palette.line}`,
          backgroundColor: 'rgba(255, 253, 248, 0.62)',
          boxShadow: shadows.sm,
        }}
      >
        <SectionHeader
          title="Sam / protagonist"
          note="layered paper-cut · 6 poses · phone screen slot"
          style={{ top: 20, left: 24, right: 24 }}
        />
        <div
          style={{
            position: 'absolute',
            left: 24,
            top: 64,
            width: 1088,
            height: 764,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(2, 1fr)',
            gap: 16,
          }}
        >
          <SamCell
            index="01"
            pose="walk"
            title="Walk"
            note="stride cycle · frame-driven"
            progress={0.28}
            frame={frame}
          />
          <SamCell
            index="02"
            pose="stop"
            title="Stop"
            note="idle breath"
            frame={frame}
          />
          <SamCell
            index="03"
            pose="kneel"
            title="Kneel"
            note="inspect the ground"
            progress={1}
            frame={frame}
          />
          <SamCell
            index="04"
            pose="raise-phone"
            title="Raise phone"
            note="report · screen slot"
            progress={1}
            phoneScreen={<GalleryPhoneScreen mode="report" />}
            frame={frame}
          />
          <SamCell
            index="05"
            pose="take-photo"
            title="Take photo"
            note="flash burst"
            progress={1}
            flash
            phoneScreen={<GalleryPhoneScreen mode="report" />}
            frame={frame}
          />
          <SamCell
            index="06"
            pose="look-at-screen"
            title="Look at screen"
            note="triage · both hands"
            progress={1}
            phoneScreen={<GalleryPhoneScreen mode="case" />}
            frame={frame}
          />
        </div>
      </div>

      {/* Right panel — supporting cast + set-pieces */}
      <div
        style={{
          position: 'absolute',
          left: 1216,
          top: 180,
          width: 640,
          height: 852,
          borderRadius: 28,
          border: `1px solid ${palette.line}`,
          backgroundColor: 'rgba(255, 253, 248, 0.62)',
          boxShadow: shadows.sm,
        }}
      >
        <SectionHeader
          title="Supporting cast"
          note="ink-line · 10 figures"
          style={{ top: 18, left: 20, right: 20 }}
        />
        <div
          style={{
            position: 'absolute',
            left: 20,
            top: 48,
            width: 600,
            height: 278,
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gridTemplateRows: 'repeat(2, 1fr)',
            columnGap: 8,
            rowGap: 6,
          }}
        >
          <CastCell label="STAND" color={palette.mint}>
            <StickFigure
              pose="stand"
              width={60}
              height={104}
              frame={frame}
              colorTag={palette.mint}
            />
          </CastCell>
          <CastCell label="WALK" color={palette.green}>
            <StickFigure
              pose="walk"
              width={60}
              height={104}
              frame={frame}
              progress={0.28}
              colorTag={palette.green}
            />
          </CastCell>
          <CastCell label="KNEEL" color={palette.amber}>
            <StickFigure
              pose="kneel"
              width={60}
              height={104}
              frame={frame}
              colorTag={palette.amber}
            />
          </CastCell>
          <CastCell label="VOTE CARD" color={palette.green}>
            <StickFigure
              pose="raise-card"
              width={60}
              height={104}
              frame={frame}
              cardLabel="YES"
              cardTone={palette.mint}
              sash={palette.green}
              colorTag={palette.green}
            />
          </CastCell>
          <CastCell label="ENVELOPE" color={palette.mint}>
            <StickFigure
              pose="hold-envelope"
              width={60}
              height={104}
              frame={frame}
              colorTag={palette.mint}
            />
          </CastCell>
          <CastCell label="CLIPBOARD" color={palette.blue}>
            <StickFigure
              pose="hold-clipboard"
              width={60}
              height={104}
              frame={frame}
              colorTag={palette.blue}
            />
          </CastCell>
          <CastCell label="PHONE" color={palette.mint}>
            <StickFigure
              pose="hold-phone"
              width={60}
              height={104}
              frame={frame}
              colorTag={palette.mint}
            />
          </CastCell>
          <CastCell label="CONTRACTOR" color={palette.amber}>
            <Contractor width={60} height={104} frame={frame} />
          </CastCell>
          <CastCell label="INSPECTOR" color={palette.blue}>
            <Inspector width={60} height={104} frame={frame} />
          </CastCell>
          <CastCell label="NEIGHBOR" color={palette.mint}>
            <Neighbor width={60} height={104} frame={frame} />
          </CastCell>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 20,
            right: 20,
            top: 338,
            height: 1,
            background: palette.line,
          }}
        />

        <SectionHeader
          title="Council table"
          note="2 yes · 1 abstain · gavel + stamp"
          style={{ top: 352, left: 20, right: 20 }}
        />
        <div style={{ position: 'absolute', left: 40, top: 378 }}>
          <CouncilTable
            width={560}
            height={199}
            frame={frame}
            revealProgress={1}
          />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 20,
            right: 20,
            top: 590,
            height: 1,
            background: palette.line,
          }}
        />

        <SectionHeader
          title="Sealed bids"
          note="winner b · lowest bid"
          style={{ top: 604, left: 20, right: 20 }}
        />
        <div style={{ position: 'absolute', left: 20, top: 630 }}>
          <BidderRow
            width={600}
            height={200}
            frame={frame}
            revealed
            winner="B"
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
