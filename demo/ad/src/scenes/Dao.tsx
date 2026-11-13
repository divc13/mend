import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Caption } from '../components/Caption';
import { Chip } from '../components/Chip';
import { Icon } from '../components/Icon';
import { KineticNumber } from '../components/KineticNumber';
import { ChapterMark } from '../components/LowerThird';
import { BeatHeadings } from '../components/SceneHeading';
import { SceneBackdrop } from '../components/SceneBackdrop';
import { beatOpacity, fadeIn, seconds } from '../motion';
import { fonts, palette } from '../theme';
import type { SceneProps } from '../types';

const CardShell: React.FC<{
  title: string;
  eyebrow: string;
  status?: string;
  statusTone?: 'mint' | 'amber' | 'green';
  children: ReactNode;
  style?: CSSProperties;
}> = ({ title, eyebrow, status, statusTone = 'amber', children, style }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      borderRadius: 28,
      backgroundColor: palette.surface,
      border: `1px solid ${palette.line}`,
      boxShadow: '0 30px 80px rgba(17, 34, 29, 0.14)',
      padding: '30px 34px',
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: 13,
            letterSpacing: '0.16em',
            color: palette.amber,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            marginTop: 6,
            fontFamily: fonts.display,
            fontSize: 38,
            fontWeight: 600,
            lineHeight: 1.05,
            color: palette.ink,
          }}
        >
          {title}
        </div>
      </div>
      {status ? (
        <Chip tone={statusTone} size="sm" icon={statusTone === 'green' ? 'check' : 'clock'}>
          {status}
        </Chip>
      ) : null}
    </div>
    <div style={{ height: 1, backgroundColor: palette.line, margin: '20px 0' }} />
    {children}
  </div>
);

const InfoRow: React.FC<{ label: string; value: ReactNode; strong?: boolean }> = ({
  label,
  value,
  strong,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 24,
      padding: '11px 0',
      borderBottom: `1px solid ${palette.line}`,
    }}
  >
    <span style={{ fontFamily: fonts.body, fontSize: 17, color: palette.muted }}>{label}</span>
    <span
      style={{
        fontFamily: strong ? fonts.display : fonts.body,
        fontSize: strong ? 28 : 19,
        fontWeight: strong ? 600 : 600,
        color: palette.ink,
        textAlign: 'right',
      }}
    >
      {value}
    </span>
  </div>
);

export const Dao: React.FC<SceneProps> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = (value: number) => seconds(value, fps);
  const starts = [at(0), at(10), at(22), at(31)];
  const beats = [
    {
      kicker: 'Step 01 · Propose',
      title: 'The steward\nproposes.',
      body: 'A repair scope. A maximum budget. A contractor roster. Prepared by a human.',
    },
    {
      kicker: 'Step 02 · Authorize',
      title: 'The DAO\nauthorizes.',
      body: 'Two of three council votes. Not the AI. Not a platform.',
    },
    {
      kicker: 'Step 03 · Constrain',
      title: 'No AI payment\nauthority.',
      body: 'The AI suggests. The community authorizes. The contracts execute.',
    },
    {
      kicker: 'Step 04 · Prove',
      title: 'Every decision\nhas a receipt.',
      body: 'Budget, roster and scoring policy are pinned on-chain.',
    },
  ];
  const vote2 = fadeIn(frame, starts[1] + 32, 18);
  const vote3 = fadeIn(frame, starts[1] + 58, 18);
  const authorized = fadeIn(frame, starts[1] + 86, 20);

  return (
    <AbsoluteFill>
      <SceneBackdrop tone="paper" />
      <ChapterMark chapter={scene.chapter} tone="paper" />
      <BeatHeadings
        beats={beats}
        starts={starts}
        tone="paper"
        size={78}
        style={{ left: 120, top: 205, width: 760, height: 330 }}
      />

      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 706,
          width: 760,
          padding: '18px 20px',
          borderRadius: 18,
          backgroundColor: palette.surfaceSoft,
          border: `1px solid ${palette.line}`,
        }}
      >
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: 12,
            letterSpacing: '0.16em',
            color: palette.muted,
            marginBottom: 12,
          }}
        >
          PAYMENT AUTHORITY
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Chip tone="paper" size="sm" icon="users">
            Community
          </Chip>
          <Icon name="arrowRight" size={16} color={palette.muted} />
          <Chip tone="paper" size="sm" icon="file">
            Steward
          </Chip>
          <Icon name="arrowRight" size={16} color={palette.muted} />
          <Chip tone="green" size="sm" icon="vote">
            DAO
          </Chip>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <div style={{ flex: 1, height: 1, borderTop: `1px dashed ${palette.lineStrong}` }} />
          <Chip tone="red" size="sm" icon="x">
            AI · suggests only
          </Chip>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 980, top: 140, width: 820, height: 720 }}>
        <div style={{ position: 'absolute', inset: 0, opacity: beatOpacity(frame, 0, starts) }}>
          <CardShell title="Repair proposal" eyebrow="REPAIR PROPOSAL" status="Draft">
            <InfoRow label="Asset" value="Public pothole" />
            <InfoRow label="Scope" value="Cold patch · footway" />
            <InfoRow
              label="Maximum budget"
              value={<KineticNumber value={100} delay={20} suffix=" USDC" />}
              strong
            />
            <InfoRow label="Contractor roster" value="3 eligible" />
            <InfoRow label="Scoring policy" value="Hash-pinned" />
            <div
              style={{
                marginTop: 18,
                padding: '14px 16px',
                borderRadius: 14,
                backgroundColor: palette.amberSoft,
                border: '1px solid rgba(169, 103, 18, 0.24)',
                fontFamily: fonts.body,
                fontSize: 15,
                lineHeight: 1.45,
                color: palette.amberStrong,
              }}
            >
              Prepared by the community steward. Nothing moves until the DAO votes.
            </div>
          </CardShell>
        </div>

        <div style={{ position: 'absolute', inset: 0, opacity: beatOpacity(frame, 1, starts) }}>
          <CardShell title="Council vote" eyebrow="SPUTNIK DAO" status="2 of 3" statusTone="mint">
            {[
              { label: 'Council seat 01', value: 'Yes', ready: true, delay: starts[1] + 20 },
              { label: 'Council seat 02', value: 'Yes', ready: true, delay: starts[1] + 32 },
              { label: 'Council seat 03', value: 'Pending', ready: false, delay: starts[1] + 44 },
            ].map((row) => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 0',
                  borderBottom: `1px solid ${palette.line}`,
                  opacity: fadeIn(frame, row.delay, 18),
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: row.ready ? palette.mintSoft : palette.paper,
                    color: row.ready ? palette.green : palette.amber,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${row.ready ? palette.mint : palette.line}`,
                  }}
                >
                  <Icon name={row.ready ? 'check' : 'clock'} size={19} strokeWidth={2.6} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: fonts.body, fontSize: 18, fontWeight: 650, color: palette.ink }}>
                    {row.label}
                  </div>
                  <div style={{ fontFamily: fonts.body, fontSize: 14, color: palette.muted }}>
                    {row.ready ? 'Vote recorded on-chain' : 'Awaiting signature'}
                  </div>
                </div>
                <Chip tone={row.ready ? 'green' : 'amber'} size="sm">
                  {row.value}
                </Chip>
              </div>
            ))}
            <div style={{ marginTop: 22, display: 'flex', alignItems: 'flex-end', gap: 18 }}>
              <div
                style={{
                  fontFamily: fonts.display,
                  fontSize: 86,
                  fontWeight: 600,
                  lineHeight: 0.9,
                  color: palette.green,
                }}
              >
                <KineticNumber value={2} delay={starts[1] + 30} /> / 3
              </div>
              <div style={{ flex: 1, paddingBottom: 10 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      style={{
                        flex: 1,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor:
                          index < 2 ? palette.green : palette.paper,
                        border: index < 2 ? 'none' : `1px solid ${palette.line}`,
                        opacity: index === 0 ? 1 : index === 1 ? vote2 : vote3,
                      }}
                    />
                  ))}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontFamily: fonts.mono,
                    fontSize: 12,
                    letterSpacing: '0.12em',
                    color: palette.muted,
                  }}
                >
                  THRESHOLD · 2 OF 3
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 'auto',
                alignSelf: 'flex-start',
                padding: '10px 18px',
                border: `2px solid ${palette.green}`,
                borderRadius: 10,
                color: palette.green,
                fontFamily: fonts.mono,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '0.12em',
                transform: `rotate(-3deg) scale(${0.9 + authorized * 0.1})`,
                opacity: authorized,
              }}
            >
              AUTHORIZED
            </div>
          </CardShell>
        </div>

        <div style={{ position: 'absolute', inset: 0, opacity: beatOpacity(frame, 2, starts) }}>
          <CardShell title="Payment authority" eyebrow="WHO CAN MOVE MONEY" status="Enforced" statusTone="green">
            {[
              { icon: 'users' as const, title: 'Community DAO', note: 'Authorizes the budget', ok: true },
              { icon: 'file' as const, title: 'Community steward', note: 'Proposes the scope', ok: true },
              { icon: 'spark' as const, title: 'AI triage', note: 'Suggests only. No payment authority.', ok: false },
              { icon: 'server' as const, title: 'MEND platform', note: 'No custody. No discretionary spend.', ok: false },
            ].map((row) => (
              <div
                key={row.title}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '16px 0',
                  borderBottom: `1px solid ${palette.line}`,
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: row.ok ? palette.mintSoft : palette.redSoft,
                    color: row.ok ? palette.green : palette.red,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name={row.icon} size={21} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: fonts.body, fontSize: 19, fontWeight: 650, color: palette.ink }}>
                    {row.title}
                  </div>
                  <div style={{ fontFamily: fonts.body, fontSize: 14, color: palette.muted }}>
                    {row.note}
                  </div>
                </div>
                <Chip tone={row.ok ? 'green' : 'red'} size="sm" icon={row.ok ? 'check' : 'x'}>
                  {row.ok ? 'Allowed' : 'No authority'}
                </Chip>
              </div>
            ))}
            <div
              style={{
                marginTop: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                border: `2px solid ${palette.red}`,
                borderRadius: 14,
                color: palette.red,
                fontFamily: fonts.mono,
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: '0.1em',
                transform: 'rotate(-2deg)',
                opacity: fadeIn(frame, starts[2] + 30, 20),
              }}
            >
              AI CANNOT PAY
            </div>
          </CardShell>
        </div>

        <div style={{ position: 'absolute', inset: 0, opacity: beatOpacity(frame, 3, starts) }}>
          <CardShell title="Decision receipt" eyebrow="ON-CHAIN RECEIPT" status="Verified" statusTone="green">
            {[
              ['Scope hash', 'Pinned'],
              ['Maximum budget', '100 USDC'],
              ['Contractor roster', '3 eligible'],
              ['Scoring policy', 'Hash-pinned'],
              ['Council vote', '2 of 3'],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '13px 0',
                  borderBottom: `1px solid ${palette.line}`,
                }}
              >
                <Icon name="check" size={18} color={palette.green} strokeWidth={2.8} />
                <span style={{ flex: 1, fontFamily: fonts.body, fontSize: 18, color: palette.ink }}>
                  {label}
                </span>
                <span style={{ fontFamily: fonts.mono, fontSize: 14, color: palette.muted }}>
                  {value}
                </span>
              </div>
            ))}
            <div
              style={{
                marginTop: 18,
                padding: '14px 16px',
                borderRadius: 12,
                backgroundColor: palette.greenDark,
                color: palette.mint,
                fontFamily: fonts.mono,
                fontSize: 13,
                letterSpacing: '0.08em',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              sputnik-dao.near · vote receipt · 0x7a3f…c21e
            </div>
            <div
              style={{
                marginTop: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Chip tone="mint" size="sm" icon="shield">
                NEAR testnet
              </Chip>
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
                  transform: 'rotate(-3deg)',
                }}
              >
                VERIFIED
              </div>
            </div>
          </CardShell>
        </div>
      </div>

      <Caption text={scene.caption} delay={at(0.8)} />
    </AbsoluteFill>
  );
};
