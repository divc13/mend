import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { Img } from 'remotion';
import { Chip } from './Chip';
import { Icon } from './Icon';
import { fonts, palette } from '../theme';

export type PhoneScreen =
  | 'report'
  | 'privacy'
  | 'triage'
  | 'case'
  | 'steward'
  | 'bids'
  | 'inspector'
  | 'passport'
  | 'tech'
  | 'trust'
  | 'generic';

type PhoneFrameProps = {
  width?: number;
  height?: number;
  src?: string | null;
  screen?: PhoneScreen;
  label?: string;
  children?: ReactNode;
  style?: CSSProperties;
};

const StatusBar: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      top: 44,
      left: 24,
      right: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 4,
    }}
  >
    <span
      style={{
        fontFamily: fonts.body,
        fontSize: 12,
        fontWeight: 700,
        color: palette.ink,
      }}
    >
      9:41
    </span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
        {[4, 6, 8, 10].map((height) => (
          <div
            key={height}
            style={{
              width: 3,
              height,
              borderRadius: 1,
              backgroundColor: palette.ink,
              opacity: 0.8,
            }}
          />
        ))}
      </div>
      <svg width="15" height="11" viewBox="0 0 15 11" aria-hidden="true">
        <path
          d="M1 4.2C4.8 0.8 10.2 0.8 14 4.2M3.5 6.8c2.3-2 5.7-2 8 0M6 9.2c.9-.8 2.1-.8 3 0"
          fill="none"
          stroke={palette.ink}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          width: 20,
          height: 10,
          borderRadius: 3,
          border: `1.4px solid ${palette.ink}`,
          padding: 1.5,
          opacity: 0.8,
        }}
      >
        <div
          style={{
            width: '78%',
            height: '100%',
            borderRadius: 1,
            backgroundColor: palette.green,
          }}
        />
      </div>
    </div>
  </div>
);

const AppHeader: React.FC<{ label?: string }> = ({ label }) => (
  <div
    style={{
      position: 'absolute',
      top: 76,
      left: 22,
      right: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="2" y="2" width="60" height="60" rx="18" fill={palette.green} />
        <path
          d="M16 35h8l4-11 5 22 4-11h8"
          fill="none"
          stroke={palette.mint}
          strokeWidth="4.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        style={{
          fontFamily: fonts.display,
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '0.14em',
          color: palette.ink,
        }}
      >
        MEND
      </span>
    </div>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: fonts.mono,
        fontSize: 8,
        letterSpacing: '0.08em',
        color: palette.muted,
        textTransform: 'uppercase',
      }}
    >
      {label ?? 'PRIVATE'}
    </div>
  </div>
);

const Row: React.FC<{
  icon: React.ComponentProps<typeof Icon>['name'];
  title: string;
  value: string;
  tone?: 'green' | 'amber' | 'red' | 'muted';
}> = ({ icon, title, value, tone = 'muted' }) => {
  const color =
    tone === 'green'
      ? palette.green
      : tone === 'amber'
        ? palette.amber
        : tone === 'red'
          ? palette.red
          : palette.muted;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 0',
        borderBottom: `1px solid ${palette.line}`,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${color}18`,
          color,
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={16} strokeWidth={2.2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 12,
            fontWeight: 650,
            color: palette.ink,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 10,
            color: palette.muted,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
};

const PrimaryButton: React.FC<{ children: ReactNode }> = ({ children }) => (
  <div
    style={{
      marginTop: 14,
      height: 46,
      borderRadius: 13,
      backgroundColor: palette.green,
      color: palette.paper,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: 650,
      boxShadow: '0 8px 18px rgba(14, 74, 57, 0.22)',
    }}
  >
    <Icon name="lock" size={14} strokeWidth={2.4} />
    {children}
  </div>
);

const ReportScreen: React.FC = () => (
  <>
    <div
      style={{
        fontFamily: fonts.mono,
        fontSize: 9,
        letterSpacing: '0.16em',
        color: palette.amber,
        marginBottom: 5,
      }}
    >
      NEW REPORT
    </div>
    <div
      style={{
        fontFamily: fonts.display,
        fontSize: 27,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        lineHeight: 1.05,
        color: palette.ink,
      }}
    >
      Report a problem
    </div>
    <div
      style={{
        fontFamily: fonts.body,
        fontSize: 10,
        color: palette.muted,
        marginTop: 3,
      }}
    >
      No wallet needed.
    </div>
    <div
      style={{
        marginTop: 14,
        height: 188,
        borderRadius: 18,
        border: `1.5px dashed ${palette.lineStrong}`,
        background: `linear-gradient(145deg, ${palette.mintSoft}, ${palette.surfaceSoft})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: palette.green,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 16,
          backgroundColor: palette.surface,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 16px rgba(14, 74, 57, 0.12)',
        }}
      >
        <Icon name="camera" size={26} strokeWidth={2} />
      </div>
      <div style={{ fontFamily: fonts.body, fontSize: 12, fontWeight: 650 }}>
        Add a photo
      </div>
      <div style={{ fontFamily: fonts.body, fontSize: 9, color: palette.muted }}>
        Processed on this device
      </div>
    </div>
    <div style={{ marginTop: 10 }}>
      <Row icon="pin" title="Public location" value="Dropped pin · exact address hidden" tone="green" />
      <Row icon="file" title="One sentence" value="Pothole on the corner, about 40 cm wide" />
    </div>
    <PrimaryButton>Send privately</PrimaryButton>
    <div
      style={{
        marginTop: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        fontFamily: fonts.body,
        fontSize: 8,
        color: palette.muted,
      }}
    >
      <Icon name="shield" size={10} strokeWidth={2.2} />
      EXIF &amp; GPS removed in your browser
    </div>
  </>
);

const PrivacyScreen: React.FC = () => (
  <>
    <div
      style={{
        width: 58,
        height: 58,
        borderRadius: 20,
        backgroundColor: palette.mintSoft,
        color: palette.green,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
      }}
    >
      <Icon name="shield" size={32} strokeWidth={1.9} />
    </div>
    <div
      style={{
        fontFamily: fonts.display,
        fontSize: 27,
        fontWeight: 600,
        lineHeight: 1.05,
        color: palette.ink,
      }}
    >
      Privacy check
    </div>
    <div
      style={{
        fontFamily: fonts.body,
        fontSize: 10,
        color: palette.muted,
        marginTop: 4,
        marginBottom: 12,
      }}
    >
      Before anything leaves your phone.
    </div>
    <Row icon="pin" title="GPS coordinates" value="Removed" tone="red" />
    <Row icon="camera" title="EXIF camera data" value="Removed" tone="red" />
    <Row icon="code" title="Device identifiers" value="Removed" tone="red" />
    <div
      style={{
        marginTop: 14,
        padding: '12px 14px',
        borderRadius: 13,
        backgroundColor: palette.mintSoft,
        border: `1px solid ${palette.mint}`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: palette.green,
        fontFamily: fonts.body,
        fontSize: 11,
        fontWeight: 650,
      }}
    >
      <Icon name="check" size={15} strokeWidth={2.6} />
      Clean payload ready
    </div>
    <div
      style={{
        marginTop: 14,
        fontFamily: fonts.mono,
        fontSize: 8,
        lineHeight: 1.6,
        color: palette.muted,
        letterSpacing: '0.02em',
      }}
    >
      only photo · public location · sentence
    </div>
  </>
);

const TriageScreen: React.FC = () => (
  <>
    <Chip tone="amber" size="sm" style={{ marginBottom: 10 }}>
      AI suggestion
    </Chip>
    <div
      style={{
        fontFamily: fonts.display,
        fontSize: 27,
        fontWeight: 600,
        lineHeight: 1.05,
        color: palette.ink,
      }}
    >
      Private triage
    </div>
    <div
      style={{
        fontFamily: fonts.body,
        fontSize: 10,
        color: palette.muted,
        marginTop: 4,
        marginBottom: 10,
      }}
    >
      Checks duplicates. Drafts a scope.
    </div>
    <Row icon="users" title="Duplicate check" value="2 nearby reports" tone="green" />
    <Row icon="file" title="Scope draft" value="Ready for steward review" tone="green" />
    <Row icon="shield" title="Payment authority" value="None" tone="red" />
    <div
      style={{
        marginTop: 14,
        padding: '11px 12px',
        borderRadius: 12,
        backgroundColor: palette.amberSoft,
        border: `1px solid rgba(169, 103, 18, 0.25)`,
        fontFamily: fonts.body,
        fontSize: 10,
        lineHeight: 1.45,
        color: palette.amberStrong,
      }}
    >
      AI suggests. A steward approves. The DAO authorizes.
    </div>
  </>
);

const CaseScreen: React.FC = () => (
  <>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}
    >
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 9,
          letterSpacing: '0.14em',
          color: palette.muted,
        }}
      >
        WORK ORDER
      </div>
      <Chip tone="mint" size="sm" icon="check">
        Authorized
      </Chip>
    </div>
    <div
      style={{
        fontFamily: fonts.display,
        fontSize: 26,
        fontWeight: 600,
        lineHeight: 1.06,
        color: palette.ink,
      }}
    >
      Pothole repair
    </div>
    <div
      style={{
        fontFamily: fonts.body,
        fontSize: 10,
        color: palette.muted,
        marginTop: 3,
        marginBottom: 10,
      }}
    >
      Public asset · Riverside corner
    </div>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        marginBottom: 12,
      }}
    >
      {[
        ['Reports', '2 merged'],
        ['Budget', '100 USDC'],
        ['Bids', '3 sealed'],
        ['Policy', 'hash-pinned'],
      ].map(([label, value]) => (
        <div
          key={label}
          style={{
            padding: '10px 11px',
            borderRadius: 11,
            backgroundColor: palette.surfaceSoft,
            border: `1px solid ${palette.line}`,
          }}
        >
          <div style={{ fontFamily: fonts.body, fontSize: 8, color: palette.muted }}>
            {label}
          </div>
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: 12,
              fontWeight: 650,
              color: palette.ink,
            }}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {['Reported', 'Authorized', 'Bids sealed', 'Repair scheduled'].map((step, index) => (
        <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: index < 3 ? palette.green : palette.surface,
              border: index < 3 ? 'none' : `1.5px solid ${palette.lineStrong}`,
              color: palette.paper,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {index < 3 ? <Icon name="check" size={10} strokeWidth={3} /> : null}
          </div>
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: 10,
              color: index < 3 ? palette.ink : palette.muted,
              padding: '5px 0',
            }}
          >
            {step}
          </div>
        </div>
      ))}
    </div>
  </>
);

const GenericScreen: React.FC<{ label: string }> = ({ label }) => (
  <>
    <div
      style={{
        fontFamily: fonts.mono,
        fontSize: 9,
        letterSpacing: '0.16em',
        color: palette.amber,
        marginBottom: 5,
      }}
    >
      MEND
    </div>
    <div
      style={{
        fontFamily: fonts.display,
        fontSize: 26,
        fontWeight: 600,
        lineHeight: 1.05,
        color: palette.ink,
      }}
    >
      {label}
    </div>
    <div
      style={{
        marginTop: 16,
        height: 210,
        borderRadius: 16,
        backgroundColor: palette.surfaceSoft,
        border: `1px solid ${palette.line}`,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
      }}
    >
      {[88, 72, 94, 60].map((width, index) => (
        <div
          key={index}
          style={{
            height: 10,
            width: `${width}%`,
            borderRadius: 5,
            backgroundColor: index === 0 ? palette.mint : palette.paperDeep,
          }}
        />
      ))}
    </div>
  </>
);

const AppScreen: React.FC<{ screen: PhoneScreen; label: string }> = ({ screen, label }) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: palette.surface,
        backgroundImage:
          'radial-gradient(260px 220px at 90% 0%, rgba(143, 211, 180, 0.25), transparent 70%)',
        overflow: 'hidden',
      }}
    >
      <StatusBar />
      <AppHeader label={screen === 'privacy' ? 'PRIVATE' : 'MEND'} />
      <div style={{ position: 'absolute', top: 128, left: 22, right: 22, bottom: 20 }}>
        {screen === 'report' ? <ReportScreen /> : null}
        {screen === 'privacy' ? <PrivacyScreen /> : null}
        {screen === 'triage' ? <TriageScreen /> : null}
        {screen === 'case' ? <CaseScreen /> : null}
        {screen !== 'report' &&
        screen !== 'privacy' &&
        screen !== 'triage' &&
        screen !== 'case' ? (
          <GenericScreen label={label} />
        ) : null}
      </div>
    </div>
  );
};

export const PhoneFrame: React.FC<PhoneFrameProps> = ({
  width = 340,
  height = 720,
  src,
  screen = 'report',
  label = 'MEND',
  children,
  style,
}) => {
  const [failed, setFailed] = useState(false);
  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: 54,
        padding: 11,
        background: 'linear-gradient(160deg, #17251f 0%, #060f0c 100%)',
        boxShadow:
          '0 44px 110px rgba(0, 0, 0, 0.34), inset 0 0 0 1px rgba(255, 255, 255, 0.09)',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -3,
          top: 170,
          width: 3,
          height: 76,
          borderRadius: 2,
          backgroundColor: '#22332b',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: -3,
          top: 150,
          width: 3,
          height: 48,
          borderRadius: 2,
          backgroundColor: '#22332b',
        }}
      />
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: 44,
          overflow: 'hidden',
          backgroundColor: palette.surface,
        }}
      >
        {children ? (
          children
        ) : src && !failed ? (
          <Img
            src={src}
            onError={() => setFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
          />
        ) : (
          <AppScreen screen={screen} label={label} />
        )}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 108,
            height: 24,
            borderRadius: 14,
            backgroundColor: '#060f0c',
            zIndex: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.14)',
            }}
          />
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 7,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 108,
            height: 4,
            borderRadius: 2,
            backgroundColor: 'rgba(17, 34, 29, 0.28)',
            zIndex: 6,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(115deg, rgba(255, 255, 255, 0.13), transparent 34%)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
};

type BrowserFrameProps = {
  width?: number;
  height?: number;
  src?: string | null;
  label?: string;
  urlLabel?: string;
  children?: ReactNode;
  style?: CSSProperties;
};

export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  width = 560,
  height = 360,
  src,
  label = 'MEND',
  urlLabel = 'mend / replay',
  children,
  style,
}) => {
  const [failed, setFailed] = useState(false);
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 22,
        overflow: 'hidden',
        backgroundColor: palette.surface,
        border: `1px solid ${palette.line}`,
        boxShadow: '0 30px 80px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      <div
        style={{
          height: 46,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          backgroundColor: '#efe9db',
          borderBottom: `1px solid ${palette.line}`,
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          {[palette.red, palette.amber, palette.green].map((color) => (
            <div
              key={color}
              style={{
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: color,
                opacity: 0.72,
              }}
            />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            height: 26,
            borderRadius: 8,
            backgroundColor: palette.surface,
            border: `1px solid ${palette.line}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontFamily: fonts.mono,
            fontSize: 11,
            color: palette.muted,
          }}
        >
          <Icon name="lock" size={11} strokeWidth={2.4} />
          {urlLabel}
        </div>
      </div>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {children ? (
          children
        ) : src && !failed ? (
          <Img
            src={src}
            onError={() => setFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(150deg, ${palette.surface}, ${palette.surfaceSoft})`,
              padding: 22,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                fontFamily: fonts.display,
                fontSize: 28,
                fontWeight: 600,
                color: palette.ink,
              }}
            >
              {label}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  style={{
                    flex: 1,
                    height: 96,
                    borderRadius: 12,
                    backgroundColor: index === 0 ? palette.mintSoft : palette.paper,
                    border: `1px solid ${palette.line}`,
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[90, 76, 84].map((width, index) => (
                <div
                  key={index}
                  style={{
                    height: 9,
                    width: `${width}%`,
                    borderRadius: 4,
                    backgroundColor: palette.paperDeep,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
