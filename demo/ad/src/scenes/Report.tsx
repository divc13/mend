import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { assetSrc } from '../assets';
import { Caption } from '../components/Caption';
import { Chip } from '../components/Chip';
import { Icon } from '../components/Icon';
import { ChapterMark } from '../components/LowerThird';
import { BrowserFrame } from '../components/PhoneFrame';
import { BeatHeadings } from '../components/SceneHeading';
import { SceneBackdrop } from '../components/SceneBackdrop';
import { beatOpacity, CLAMP, fadeIn, seconds } from '../motion';
import { fonts, palette } from '../theme';
import type { SceneProps } from '../types';

const StepRail: React.FC<{ active: number; starts: number[] }> = ({ active, starts }) => {
  const frame = useCurrentFrame();
  const steps = [
    { label: '01', title: 'Photo', note: 'Camera + pin' },
    { label: '02', title: 'Scrub', note: 'EXIF + GPS' },
    { label: '03', title: 'Triage', note: 'Private AI' },
    { label: '04', title: 'Merge', note: 'One order' },
  ];
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {steps.map((step, index) => {
        const isActive = index === active;
        const isPast = index < active;
        const reveal = fadeIn(frame, starts[index] ?? 0, 16);
        return (
          <div
            key={step.label}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 10px',
              borderRadius: 12,
              backgroundColor: isActive ? palette.surface : 'transparent',
              border: `1px solid ${isActive ? palette.mint : palette.line}`,
              opacity: isActive ? 1 : 0.52 + (isPast ? 0.12 : 0),
              boxShadow: isActive ? '0 8px 20px rgba(17, 34, 29, 0.06)' : 'none',
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: isActive ? palette.green : isPast ? palette.mintSoft : palette.surface,
                border: `1px solid ${isActive ? palette.green : isPast ? palette.mint : palette.line}`,
                color: isActive ? palette.paper : isPast ? palette.green : palette.muted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: fonts.mono,
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
                opacity: reveal,
              }}
            >
              {isPast ? <Icon name="check" size={14} strokeWidth={3} /> : step.label}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: fonts.body,
                  fontSize: 14,
                  fontWeight: 650,
                  color: isActive ? palette.ink : palette.inkSoft,
                  whiteSpace: 'nowrap',
                }}
              >
                {step.title}
              </div>
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  color: isActive ? palette.amber : palette.muted,
                  whiteSpace: 'nowrap',
                }}
              >
                {step.note.toUpperCase()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const EntryCards: React.FC = () => {
  const frame = useCurrentFrame();
  const items = [
    { icon: 'camera' as const, title: 'Photo', note: 'Processed on device' },
    { icon: 'pin' as const, title: 'Location', note: 'Public pin only' },
    { icon: 'file' as const, title: 'One sentence', note: 'No forms' },
  ];
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      {items.map((item, index) => (
        <div
          key={item.title}
          style={{
            flex: 1,
            height: 126,
            borderRadius: 18,
            padding: '16px 18px',
            backgroundColor: palette.surface,
            border: `1px solid ${palette.line}`,
            boxShadow: '0 14px 34px rgba(17, 34, 29, 0.08)',
            opacity: fadeIn(frame, 12 + index * 7, 20),
            transform: `translateY(${(1 - fadeIn(frame, 12 + index * 7, 20)) * 18}px)`,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 13,
              backgroundColor: palette.mintSoft,
              color: palette.green,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={item.icon} size={20} />
          </div>
          <div
            style={{
              marginTop: 8,
              fontFamily: fonts.display,
              fontSize: 23,
              fontWeight: 600,
              color: palette.ink,
            }}
          >
            {item.title}
          </div>
          <div style={{ fontFamily: fonts.body, fontSize: 12, color: palette.muted }}>
            {item.note}
          </div>
        </div>
      ))}
    </div>
  );
};

const MetaPanel: React.FC<{ starts: number[] }> = ({ starts }) => {
  const frame = useCurrentFrame();
  const strike = fadeIn(frame, (starts[1] ?? 0) + 46, 18);
  const rows = [
    { icon: 'pin' as const, title: 'GPS coordinates', note: 'Exact location never leaves the device' },
    { icon: 'camera' as const, title: 'EXIF camera data', note: 'Device, lens and timestamp removed' },
    { icon: 'code' as const, title: 'Device identifiers', note: 'No fingerprint, no wallet address' },
  ];
  return (
    <div
      style={{
        width: 700,
        borderRadius: 22,
        padding: '18px 22px',
        backgroundColor: palette.surface,
        border: `1px solid ${palette.line}`,
        boxShadow: '0 18px 44px rgba(17, 34, 29, 0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Icon name="lock" size={17} color={palette.green} />
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 12,
            letterSpacing: '0.14em',
            color: palette.green,
          }}
        >
          BROWSER SANITIZER · ON DEVICE
        </span>
      </div>
      {rows.map((row, index) => (
        <div
          key={row.title}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '8px 0',
            borderTop: `1px solid ${palette.line}`,
            opacity: fadeIn(frame, (starts[1] ?? 0) + 8 + index * 6, 16),
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: palette.redSoft,
              color: palette.red,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={row.icon} size={17} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: fonts.body, fontSize: 16, fontWeight: 650, color: palette.ink }}>
              {row.title}
            </div>
            <div style={{ fontFamily: fonts.body, fontSize: 12, color: palette.muted }}>
              {row.note}
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <Chip tone="red" size="sm">
              Removed
            </Chip>
            <div
              style={{
                position: 'absolute',
                left: -4,
                right: -4,
                top: '50%',
                height: 2,
                backgroundColor: palette.red,
                transform: `scaleX(${strike})`,
                transformOrigin: 'left',
              }}
            />
          </div>
        </div>
      ))}
      <div
        style={{
          marginTop: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: fonts.body,
          fontSize: 14,
          fontWeight: 600,
          color: palette.green,
          opacity: strike,
        }}
      >
        <Icon name="check" size={15} strokeWidth={2.8} />
        Clean payload ready to upload
      </div>
    </div>
  );
};

const TriagePanel: React.FC<{ starts: number[] }> = ({ starts }) => {
  const frame = useCurrentFrame();
  const rows = [
    { icon: 'users' as const, title: 'Duplicate check', note: 'Two nearby reports match', tone: 'green' as const },
    { icon: 'file' as const, title: 'Scope draft', note: 'Ready for steward review', tone: 'green' as const },
    { icon: 'shield' as const, title: 'Payment authority', note: 'None. The AI cannot approve.', tone: 'red' as const },
  ];
  return (
    <div
      style={{
        width: 700,
        borderRadius: 22,
        padding: '20px 22px',
        backgroundColor: palette.surface,
        border: `1px solid ${palette.line}`,
        boxShadow: '0 18px 44px rgba(17, 34, 29, 0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 12,
            letterSpacing: '0.14em',
            color: palette.amber,
          }}
        >
          PRIVATE TRIAGE
        </span>
        <Chip tone="amber" size="sm" icon="spark">
          AI suggestion
        </Chip>
      </div>
      <div style={{ marginTop: 8 }}>
        {rows.map((row, index) => (
          <div
            key={row.title}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '9px 0',
              borderTop: `1px solid ${palette.line}`,
              opacity: fadeIn(frame, (starts[2] ?? 0) + 8 + index * 7, 18),
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: row.tone === 'green' ? palette.mintSoft : palette.redSoft,
                color: row.tone === 'green' ? palette.green : palette.red,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={row.icon} size={17} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: fonts.body, fontSize: 16, fontWeight: 650, color: palette.ink }}>
                {row.title}
              </div>
              <div style={{ fontFamily: fonts.body, fontSize: 12, color: palette.muted }}>
                {row.note}
              </div>
            </div>
            <Chip tone={row.tone} size="sm" icon={row.tone === 'green' ? 'check' : 'x'}>
              {row.tone === 'green' ? 'Ready' : 'No authority'}
            </Chip>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: fonts.body,
          fontSize: 13,
          color: palette.muted,
        }}
      >
        <span>AI suggests.</span>
        <span style={{ color: palette.green, fontWeight: 650 }}>A steward approves.</span>
      </div>
    </div>
  );
};

const MergePanel: React.FC<{ starts: number[] }> = ({ starts }) => {
  const frame = useCurrentFrame();
  const merge = interpolate(
    frame,
    [(starts[3] ?? 0) + 30, (starts[3] ?? 0) + 80],
    [0, 1],
    CLAMP,
  );
  const resultIn = fadeIn(frame, (starts[3] ?? 0) + 70, 22);
  const card = (letter: string, title: string, note: string, left: number, shift: number) => (
    <div
      style={{
        position: 'absolute',
        left,
        top: 34,
        width: 300,
        height: 176,
        padding: '16px 18px',
        borderRadius: 18,
        backgroundColor: palette.surface,
        border: `1px solid ${palette.line}`,
        boxShadow: '0 14px 34px rgba(17, 34, 29, 0.08)',
        transform: `translateX(${shift}px)`,
        opacity: 1 - merge * 0.75,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: palette.mintSoft,
            color: palette.green,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: fonts.mono,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {letter}
        </div>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 10,
            letterSpacing: '0.14em',
            color: palette.muted,
          }}
        >
          REPORT {letter}
        </span>
      </div>
      <div
        style={{
          marginTop: 10,
          fontFamily: fonts.display,
          fontSize: 22,
          fontWeight: 600,
          color: palette.ink,
          lineHeight: 1.08,
        }}
      >
        {title}
      </div>
      <div style={{ marginTop: 3, fontFamily: fonts.body, fontSize: 12, color: palette.muted }}>
        {note}
      </div>
      <div style={{ marginTop: 8 }}>
        <Chip tone="ghost" size="sm" icon="lock">
          Private
        </Chip>
      </div>
    </div>
  );
  return (
    <div style={{ position: 'relative', width: 700, height: 300 }}>
      {card('A', 'Pothole on the corner', 'Photo · public pin', 0, merge * 28)}
      {card('B', 'Same pothole, second report', 'Nearby neighbor', 398, -merge * 28)}
      <div
        style={{
          position: 'absolute',
          left: 322,
          top: 110,
          width: 56,
          height: 2,
          backgroundColor: palette.mint,
          opacity: fadeIn(frame, (starts[3] ?? 0) + 8, 16),
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 324,
          top: 96,
          width: 52,
          height: 30,
          borderRadius: 15,
          backgroundColor: palette.surface,
          border: `1px solid ${palette.mint}`,
          color: palette.green,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: fadeIn(frame, (starts[3] ?? 0) + 8, 16),
        }}
      >
        <Icon name="link" size={16} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 100,
          top: 54,
          width: 500,
          height: 190,
          borderRadius: 22,
          padding: '20px 24px',
          backgroundColor: palette.green,
          color: palette.paper,
          boxShadow: '0 24px 60px rgba(14, 74, 57, 0.24)',
          opacity: resultIn,
          transform: `translateY(${(1 - resultIn) * 18}px)`,
        }}
      >
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: 11,
            letterSpacing: '0.16em',
            color: palette.mint,
          }}
        >
          WORK ORDER · MERGED PRIVATELY
        </div>
        <div
          style={{
            marginTop: 7,
            fontFamily: fonts.display,
            fontSize: 33,
            fontWeight: 600,
            lineHeight: 1.05,
          }}
        >
          One asset. Two reporters.
        </div>
        <div
          style={{
            marginTop: 7,
            fontFamily: fonts.body,
            fontSize: 15,
            color: 'rgba(245, 241, 230, 0.72)',
          }}
        >
          The duplicate disappears. The evidence stays attached.
        </div>
      </div>
    </div>
  );
};

export const Report: React.FC<SceneProps> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = (value: number) => seconds(value, fps);
  const starts = [at(0), at(10), at(22), at(33)];
  const active = frame >= starts[3] ? 3 : frame >= starts[2] ? 2 : frame >= starts[1] ? 1 : 0;
  const screens = [
    { screen: 'report' as const, src: assetSrc('appReport'), label: 'Report a problem', url: 'mend / report' },
    { screen: 'privacy' as const, src: assetSrc('appPrivacy'), label: 'Privacy check', url: 'mend / report / photo' },
    { screen: 'triage' as const, src: assetSrc('appTriage'), label: 'Private triage', url: 'mend / report / duplicate' },
    { screen: 'case' as const, src: assetSrc('appCase'), label: 'Work order', url: 'mend / cases / pothole' },
  ];
  const beats = [
    {
      kicker: 'Report',
      title: 'No wallet.\nNo forms.',
      body: 'A photo, a location, one sentence. That is the whole report.',
    },
    {
      kicker: 'Privacy',
      title: 'Nothing leaves\nraw.',
      body: 'EXIF and GPS are stripped in the browser, before anything is uploaded.',
    },
    {
      kicker: 'Triage',
      title: 'AI suggests.\nHumans decide.',
      body: 'Private triage checks duplicates and drafts a repair scope. It never approves.',
    },
    {
      kicker: 'Merge',
      title: 'Two reports.\nOne work order.',
      body: 'The same pothole is merged privately. The evidence stays together.',
    },
  ];

  return (
    <AbsoluteFill>
      <SceneBackdrop tone="paper" />
      <ChapterMark chapter={scene.chapter} tone="paper" />
      <div style={{ position: 'absolute', left: 120, top: 136, opacity: fadeIn(frame, 8, 20) }}>
        <Chip tone="mint" size="sm" icon="lock">
          Private by default
        </Chip>
      </div>
      <BeatHeadings
        beats={beats}
        starts={starts}
        tone="paper"
        size={70}
        style={{ left: 120, top: 190, width: 700, height: 290 }}
      />
      <div style={{ position: 'absolute', left: 120, top: 500, width: 700, height: 300 }}>
        <div style={{ position: 'absolute', inset: 0, opacity: beatOpacity(frame, 0, starts) }}>
          <EntryCards />
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: beatOpacity(frame, 1, starts) }}>
          <MetaPanel starts={starts} />
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: beatOpacity(frame, 2, starts) }}>
          <TriagePanel starts={starts} />
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: beatOpacity(frame, 3, starts) }}>
          <MergePanel starts={starts} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: 120, top: 790, width: 700 }}>
        <StepRail active={active} starts={starts} />
      </div>

      <div style={{ position: 'absolute', left: 880, top: 170 }}>
        {screens.map((screen, index) => (
          <div
            key={screen.screen}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              opacity: beatOpacity(frame, index, starts),
            }}
          >
            <BrowserFrame
              width={920}
              height={563}
              src={screen.src}
              label={screen.label}
              urlLabel={screen.url}
            />
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 880,
          top: 752,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          opacity: fadeIn(frame, 14, 20),
        }}
      >
        <Chip tone="amber" size="sm" icon="play">
          Replay / simulation
        </Chip>
        <span style={{ fontFamily: fonts.mono, fontSize: 12, letterSpacing: '0.12em', color: palette.muted }}>
          REAL UI CAPTURE · FROZEN FIXTURES
        </span>
      </div>

      <Caption text={scene.caption} delay={at(0.8)} />
    </AbsoluteFill>
  );
};
