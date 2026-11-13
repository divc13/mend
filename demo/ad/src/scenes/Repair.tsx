import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { AssetVideo } from '../components/Asset';
import { BeforeAfter } from '../components/BeforeAfter';
import { Caption } from '../components/Caption';
import { Chip } from '../components/Chip';
import { Icon } from '../components/Icon';
import { ChapterMark } from '../components/LowerThird';
import { RoadPlate } from '../components/RoadPlate';
import { BeatHeadings } from '../components/SceneHeading';
import { beatOpacity, CLAMP, fadeIn, seconds } from '../motion';
import { fonts, palette } from '../theme';
import type { SceneProps } from '../types';

const EvidenceCard: React.FC<{
  icon: 'camera' | 'receipt' | 'file';
  title: string;
  note: string;
  style: React.CSSProperties;
  delay: number;
}> = ({ icon, title, note, style, delay }) => {
  const frame = useCurrentFrame();
  const appear = fadeIn(frame, delay, 20);
  return (
    <div
      style={{
        position: 'absolute',
        width: 218,
        height: 148,
        padding: '16px 18px',
        borderRadius: 16,
        backgroundColor: palette.surface,
        border: `1px solid ${palette.line}`,
        boxShadow: '0 16px 38px rgba(0, 0, 0, 0.16)',
        opacity: appear,
        transform: `translateY(${(1 - appear) * 16}px)`,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: palette.mintSoft,
            color: palette.green,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={17} />
        </div>
        <Chip tone="mint" size="sm">
          Hashed
        </Chip>
      </div>
      <div
        style={{
          marginTop: 10,
          fontFamily: fonts.display,
          fontSize: 22,
          fontWeight: 600,
          color: palette.ink,
        }}
      >
        {title}
      </div>
      <div style={{ fontFamily: fonts.body, fontSize: 12, color: palette.muted }}>{note}</div>
    </div>
  );
};

const WorkOrderPanel: React.FC<{ starts: number[] }> = ({ starts }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: 'relative', width: 840, height: 620 }}>
      <svg
        width="840"
        height="620"
        viewBox="0 0 840 620"
        style={{ position: 'absolute', inset: 0 }}
        aria-hidden="true"
      >
        <g
          fill="none"
          stroke="rgba(143, 211, 180, 0.5)"
          strokeWidth="1.6"
          strokeDasharray="5 7"
          opacity={fadeIn(frame, (starts[1] ?? 0) + 18, 18)}
        >
          <path d="M 218 150 C 300 150, 300 250, 360 250" />
          <path d="M 622 150 C 540 150, 540 250, 480 250" />
          <path d="M 622 450 C 540 450, 540 360, 480 360" />
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 206,
          top: 104,
          width: 428,
          height: 380,
          borderRadius: 24,
          backgroundColor: palette.surface,
          border: `1px solid ${palette.line}`,
          boxShadow: '0 30px 70px rgba(0, 0, 0, 0.2)',
          padding: '24px 26px',
          opacity: fadeIn(frame, (starts[1] ?? 0) + 6, 20),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 12,
              letterSpacing: '0.16em',
              color: palette.muted,
            }}
          >
            WORK ORDER
          </span>
          <Chip tone="amber" size="sm" icon="hammer">
            In progress
          </Chip>
        </div>
        <div
          style={{
            marginTop: 12,
            fontFamily: fonts.display,
            fontSize: 36,
            fontWeight: 600,
            lineHeight: 1.05,
            color: palette.ink,
          }}
        >
          Pothole repair
        </div>
        <div style={{ marginTop: 4, fontFamily: fonts.body, fontSize: 14, color: palette.muted }}>
          Public asset · contractor B
        </div>
        <div style={{ marginTop: 16 }}>
          {[
            ['Scope', 'Cold patch · footway'],
            ['Evidence', '3 artifacts'],
            ['Inspection', 'Independent human'],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '9px 0',
                borderTop: `1px solid ${palette.line}`,
                fontFamily: fonts.body,
                fontSize: 14,
              }}
            >
              <span style={{ color: palette.muted }}>{label}</span>
              <span style={{ color: palette.ink, fontWeight: 650 }}>{value}</span>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 18,
            padding: '10px 12px',
            borderRadius: 10,
            backgroundColor: palette.greenDark,
            color: palette.mint,
            fontFamily: fonts.mono,
            fontSize: 11,
            letterSpacing: '0.06em',
          }}
        >
          evidence root · 0x8f3a…a2c1
        </div>
      </div>
      <EvidenceCard
        icon="camera"
        title="Photo 01"
        note="Clean · fill · compact"
        style={{ left: 0, top: 76 }}
        delay={(starts[1] ?? 0) + 14}
      />
      <EvidenceCard
        icon="receipt"
        title="Receipt"
        note="Materials · tonnage"
        style={{ right: 0, top: 76 }}
        delay={(starts[1] ?? 0) + 22}
      />
      <EvidenceCard
        icon="file"
        title="Crew note"
        note="Seal · cure time"
        style={{ right: 0, top: 396 }}
        delay={(starts[1] ?? 0) + 30}
      />
    </div>
  );
};

const InspectorPanel: React.FC<{ starts: number[] }> = ({ starts }) => {
  const frame = useCurrentFrame();
  const items = ['Surface level', 'Compaction', 'Edge seal', 'Photo evidence'];
  const stamp = fadeIn(frame, (starts[2] ?? 0) + 86, 22);
  return (
    <div
      style={{
        position: 'relative',
        width: 800,
        height: 600,
        borderRadius: 26,
        backgroundColor: palette.surface,
        border: `1px solid ${palette.line}`,
        boxShadow: '0 30px 80px rgba(0, 0, 0, 0.22)',
        padding: '28px 32px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div
            style={{
              fontFamily: fonts.mono,
              fontSize: 12,
              letterSpacing: '0.16em',
              color: palette.amber,
            }}
          >
            INDEPENDENT INSPECTION
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: fonts.display,
              fontSize: 40,
              fontWeight: 600,
              color: palette.ink,
            }}
          >
            Same checklist. New eyes.
          </div>
        </div>
        <Chip tone="mint" size="sm" icon="eye">
          Not the contractor
        </Chip>
      </div>
      <div
        style={{
          marginTop: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          borderRadius: 14,
          backgroundColor: palette.surfaceSoft,
          border: `1px solid ${palette.line}`,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: palette.green,
            color: palette.paper,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: fonts.display,
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          IN
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: fonts.body, fontSize: 17, fontWeight: 650, color: palette.ink }}>
            Independent inspector
          </div>
          <div style={{ fontFamily: fonts.body, fontSize: 13, color: palette.muted }}>
            Different human. Same evidence.
          </div>
        </div>
        <Chip tone="ghost" size="sm" icon="shield">
          No conflict
        </Chip>
      </div>
      <div style={{ marginTop: 12 }}>
        {items.map((item, index) => {
          const done = fadeIn(frame, (starts[2] ?? 0) + 22 + index * 14, 14);
          return (
            <div
              key={item}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                borderBottom: `1px solid ${palette.line}`,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9,
                  backgroundColor: palette.mintSoft,
                  border: `1px solid ${palette.mint}`,
                  color: palette.green,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.35 + done * 0.65,
                }}
              >
                <Icon name="check" size={16} strokeWidth={3} />
              </div>
              <span style={{ flex: 1, fontFamily: fonts.body, fontSize: 17, color: palette.ink }}>
                {item}
              </span>
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  color: palette.green,
                  opacity: done,
                }}
              >
                PASS
              </span>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 18,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ height: 1, width: 240, backgroundColor: palette.lineStrong }} />
          <div style={{ marginTop: 6, fontFamily: fonts.mono, fontSize: 11, color: palette.muted }}>
            INSPECTOR SIGNATURE · TODAY
          </div>
        </div>
        <div
          style={{
            padding: '10px 18px',
            border: `2px solid ${palette.green}`,
            borderRadius: 10,
            color: palette.green,
            fontFamily: fonts.mono,
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: '0.1em',
            transform: 'rotate(-4deg)',
            opacity: stamp,
          }}
        >
          PASSED
        </div>
      </div>
    </div>
  );
};

export const Repair: React.FC<SceneProps> = ({ scene, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = (value: number) => seconds(value, fps);
  const starts = [at(0), at(8), at(18), at(30)];
  const push = interpolate(frame, [0, durationInFrames], [1.03, 1.09], CLAMP);
  const beats = [
    {
      kicker: 'Step 01 · Repair',
      title: 'The repair\nbegins.',
      body: 'Clean. Fill. Compact. Seal. The work is visible.',
    },
    {
      kicker: 'Step 02 · Evidence',
      title: 'Every artifact\nis hashed.',
      body: 'Photos. Receipts. Notes. Attached to the work order.',
    },
    {
      kicker: 'Step 03 · Inspect',
      title: 'A different\nhuman inspects.',
      body: 'Not the contractor. Not the AI. A checklist, evidence, and a signature.',
    },
    {
      kicker: 'Step 04 · Prove',
      title: 'Evidence,\nnot vibes.',
      body: 'The repair passes on the record. The record is the receipt.',
    },
  ];
  const steps = ['Clean', 'Fill', 'Compact', 'Seal'];
  const passed = fadeIn(frame, starts[3] + 20, 22);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.greenDark }}>
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        <AssetVideo
          assetKey="repair"
          placeholder={<RoadPlate variant="repair" label />}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(5, 18, 14, 0.94) 0%, rgba(5, 18, 14, 0.82) 44%, rgba(5, 18, 14, 0.3) 74%, rgba(5, 18, 14, 0.52) 100%)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(0deg, rgba(5, 18, 14, 0.84) 0%, transparent 34%, transparent 76%, rgba(5, 18, 14, 0.34) 100%)',
        }}
      />
      <ChapterMark chapter={scene.chapter} tone="dark" />
      <BeatHeadings
        beats={beats}
        starts={starts}
        tone="dark"
        size={78}
        style={{ left: 120, top: 190, width: 760, height: 380 }}
      />

      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 724,
          width: 760,
          display: 'flex',
          gap: 10,
        }}
      >
        {steps.map((step, index) => {
          const done = fadeIn(frame, at(0.7 + index * 1.35), 14);
          return (
            <div
              key={step}
              style={{
                flex: 1,
                padding: '12px 12px 11px',
                borderRadius: 12,
                backgroundColor: `rgba(245, 241, 230, ${0.06 + done * 0.06})`,
                border: `1px solid rgba(245, 241, 230, ${0.12 + done * 0.18})`,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: done > 0.5 ? palette.mint : 'rgba(245, 241, 230, 0.12)',
                  color: done > 0.5 ? palette.greenDeep : palette.paper,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="check" size={13} strokeWidth={3} />
              </div>
              <span
                style={{
                  fontFamily: fonts.body,
                  fontSize: 15,
                  fontWeight: 650,
                  color: 'rgba(245, 241, 230, 0.86)',
                }}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ position: 'absolute', left: 940, top: 150, width: 840, height: 720 }}>
        <div style={{ position: 'absolute', inset: 0, opacity: beatOpacity(frame, 0, starts) }}>
          <BeforeAfter width={840} height={520} delay={at(1.5)} />
          <div
            style={{
              marginTop: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: fonts.mono,
              fontSize: 12,
              letterSpacing: '0.12em',
              color: 'rgba(245, 241, 230, 0.55)',
            }}
          >
            <Icon name="eye" size={15} color={palette.mint} />
            BEFORE / AFTER · ILLUSTRATIVE STOCK
          </div>
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: beatOpacity(frame, 1, starts) }}>
          <WorkOrderPanel starts={starts} />
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: beatOpacity(frame, 2, starts) }}>
          <InspectorPanel starts={starts} />
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: beatOpacity(frame, 3, starts) }}>
          <BeforeAfter width={840} height={520} delay={0} />
          <div
            style={{
              position: 'absolute',
              right: 24,
              bottom: 58,
              padding: '14px 24px',
              border: `3px solid ${palette.mint}`,
              borderRadius: 12,
              backgroundColor: 'rgba(7, 27, 21, 0.78)',
              color: palette.mint,
              fontFamily: fonts.mono,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '0.12em',
              transform: `rotate(-5deg) scale(${0.9 + passed * 0.1})`,
              opacity: passed,
            }}
          >
            INSPECTION PASSED
          </div>
        </div>
      </div>

      <Caption text={scene.caption} delay={at(0.8)} />
    </AbsoluteFill>
  );
};
