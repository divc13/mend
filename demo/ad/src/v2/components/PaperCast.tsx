import React from 'react';
import type { CSSProperties } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { palette } from '../../theme';

const paper = {
  skin: '#e8c7a4',
  skinShade: '#d2aa80',
  skinLight: '#f2d8ba',
  hair: '#2b241d',
  hairLight: '#3d332a',
  jacket: '#0e4a39',
  jacketLight: '#12614a',
  jacketDark: '#09372a',
  shirt: '#f7f1e2',
  pants: '#33473f',
  pantsLight: '#42584f',
  shoe: '#11221d',
  outline: '#0a1a14',
  mint: '#8fd3b4',
  amber: '#d99a3d',
  amberDeep: '#a96712',
  red: '#9f362c',
  blue: '#2f5c85',
  white: '#fffdf8',
  card: '#f5f1e6',
  cardLine: '#d9d1bf',
  ink: '#11221d',
  inkSoft: '#33473f',
  muted: '#5b6b65',
  green: '#0e4a39',
  greenDeep: '#09372a',
  mintSoft: '#e6f4ec',
  paper: '#f5f1e6',
};

const shadow = '0 18px 40px rgba(7, 27, 21, 0.22)';

type SamPose = 'walk' | 'phone' | 'point' | 'cheer' | 'inspect' | 'stand' | 'wave';

type SamProps = {
  pose?: SamPose;
  scale?: number;
  flip?: boolean;
  phoneGlow?: number;
  seed?: number;
  style?: CSSProperties;
  label?: string;
};

/**
 * Sam, built from layered paper shapes. Joints are animated with frame-based
 * sine waves so the figure never sits still, even on a held shot.
 */
export const Sam: React.FC<SamProps> = ({
  pose = 'walk',
  scale = 1,
  flip = false,
  phoneGlow = 0,
  seed = 0,
  style,
  label,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const bob = Math.sin(t * 3.1 + seed) * 3.2 + Math.sin(t * 1.3 + seed) * 1.4;
  const sway = Math.sin(t * 1.7 + seed) * 1.4;
  const walking = pose === 'walk';
  const legSwing = walking ? Math.sin(t * 6.2 + seed) * 17 : Math.sin(t * 1.4 + seed) * 2;
  const armSwing = walking ? Math.sin(t * 6.2 + seed + Math.PI) * 13 : Math.sin(t * 1.6 + seed) * 2;
  const blinkPhase = Math.sin(t * 2.2 + seed * 1.7);
  const blink = blinkPhase > 0.965 ? 0.12 : 1;

  const phoneVisible = pose === 'phone' || pose === 'walk' || pose === 'inspect';
  const phoneX = pose === 'phone' ? 158 : pose === 'inspect' ? 142 : 168;
  const phoneY = pose === 'phone' ? 224 : pose === 'inspect' ? 268 : 286;
  const phoneRotate = pose === 'phone' ? -14 : pose === 'inspect' ? 10 : -6;

  const rightArm =
    pose === 'point'
      ? 'M154 188 L196 202 L226 190'
      : pose === 'cheer'
        ? 'M154 188 L176 142 L160 112'
        : pose === 'wave'
          ? 'M154 188 L184 150 L198 122'
          : pose === 'phone'
            ? 'M154 188 L178 220 L158 246'
            : pose === 'inspect'
              ? 'M154 188 L174 240 L146 274'
              : `M154 188 L170 236 L166 282`;

  const leftArm =
    pose === 'cheer'
      ? 'M66 188 L42 142 L58 112'
      : pose === 'inspect'
        ? 'M66 188 L52 238 L76 264'
        : pose === 'phone'
          ? `M66 188 L52 236 L58 282`
          : `M66 188 L50 238 L56 284`;

  const width = 240 * scale;
  const height = 430 * scale;

  return (
    <div
      style={{
        position: 'absolute',
        width,
        height,
        filter: `drop-shadow(${shadow})`,
        transform: `scaleX(${flip ? -1 : 1})`,
        ...style,
      }}
      aria-label={label ?? 'Sam'}
    >
      <svg viewBox="0 0 240 430" width="100%" height="100%" style={{ overflow: 'visible' }}>
        <defs>
          <filter id="sam-paper-grain" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="noise" />
            <feColorMatrix type="saturate" values="0" in="noise" result="gray" />
            <feComponentTransfer in="gray" result="faint">
              <feFuncA type="linear" slope="0.06" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" in2="faint" mode="multiply" />
          </filter>
          <radialGradient id="sam-phone-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={paper.mint} stopOpacity="0.95" />
            <stop offset="55%" stopColor={paper.mint} stopOpacity="0.35" />
            <stop offset="100%" stopColor={paper.mint} stopOpacity="0" />
          </radialGradient>
        </defs>

        <g transform={`translate(0 ${bob}) rotate(${sway} 120 400)`}>
          <ellipse cx="120" cy="410" rx="72" ry="12" fill={paper.outline} opacity="0.18" />

          {/* legs */}
          <g transform={`rotate(${legSwing} 96 300)`}>
            <path d="M96 296 L90 354 L84 396" fill="none" stroke={paper.outline} strokeWidth="30" strokeLinecap="round" />
            <path d="M96 296 L90 354 L84 396" fill="none" stroke={paper.pants} strokeWidth="24" strokeLinecap="round" />
            <path d="M96 300 L94 350" fill="none" stroke={paper.pantsLight} strokeWidth="5" strokeLinecap="round" opacity="0.55" />
            <path d="M76 398 L108 398" fill="none" stroke={paper.outline} strokeWidth="17" strokeLinecap="round" />
            <path d="M77 396 L108 396" fill="none" stroke={paper.shoe} strokeWidth="12" strokeLinecap="round" />
          </g>
          <g transform={`rotate(${-legSwing} 144 300)`}>
            <path d="M144 296 L150 354 L156 396" fill="none" stroke={paper.outline} strokeWidth="30" strokeLinecap="round" />
            <path d="M144 296 L150 354 L156 396" fill="none" stroke={paper.pants} strokeWidth="24" strokeLinecap="round" />
            <path d="M144 300 L146 350" fill="none" stroke={paper.pantsLight} strokeWidth="5" strokeLinecap="round" opacity="0.55" />
            <path d="M148 398 L180 398" fill="none" stroke={paper.outline} strokeWidth="17" strokeLinecap="round" />
            <path d="M149 396 L180 396" fill="none" stroke={paper.shoe} strokeWidth="12" strokeLinecap="round" />
          </g>

          {/* torso / jacket */}
          <path
            d="M68 178 C62 212 62 266 70 306 C92 316 148 316 170 306 C178 266 178 212 172 178 C154 164 136 158 120 158 C104 158 86 164 68 178 Z"
            fill={paper.jacket}
            stroke={paper.outline}
            strokeWidth="3.4"
            strokeLinejoin="round"
          />
          <path
            d="M78 190 C74 222 74 266 80 298 C94 304 106 306 112 306 L112 166 C100 168 88 176 78 190 Z"
            fill={paper.jacketLight}
            opacity="0.75"
          />
          <path
            d="M120 162 L108 196 L120 214 L132 196 Z"
            fill={paper.shirt}
            stroke={paper.outline}
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path d="M120 214 L120 306" fill="none" stroke={paper.jacketDark} strokeWidth="3" opacity="0.8" />
          <path d="M84 252 C96 258 108 260 120 260 C132 260 144 258 156 252" fill="none" stroke={paper.jacketDark} strokeWidth="2.4" opacity="0.55" />
          <rect x="88" y="266" width="26" height="20" rx="3" fill={paper.jacketDark} opacity="0.65" />
          <rect x="126" y="266" width="26" height="20" rx="3" fill={paper.jacketDark} opacity="0.65" />
          <path d="M100 266 L100 286 M138 266 L138 286" stroke={paper.jacketLight} strokeWidth="2" opacity="0.5" />

          {/* scarf */}
          <path
            d="M86 168 C100 178 140 178 154 168 C158 178 154 190 146 194 C128 186 112 186 94 194 C86 190 82 178 86 168 Z"
            fill={paper.amber}
            stroke={paper.outline}
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <path d="M146 190 L154 226 L142 230 L136 194 Z" fill={paper.amberDeep} stroke={paper.outline} strokeWidth="2.2" strokeLinejoin="round" />

          {/* left arm */}
          <g transform={`rotate(${armSwing} 66 188)`}>
            <path d={leftArm} fill="none" stroke={paper.outline} strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
            <path d={leftArm} fill="none" stroke={paper.jacket} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={pose === 'cheer' ? 58 : pose === 'inspect' ? 76 : 56} cy={pose === 'cheer' ? 112 : pose === 'inspect' ? 264 : 284} r="9" fill={paper.skin} stroke={paper.outline} strokeWidth="2.4" />
          </g>

          {/* right arm */}
          <g transform={`rotate(${-armSwing * 0.4} 154 188)`}>
            <path d={rightArm} fill="none" stroke={paper.outline} strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
            <path d={rightArm} fill="none" stroke={paper.jacket} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
          </g>

          {/* phone + hand */}
          {phoneVisible ? (
            <g transform={`translate(${phoneX} ${phoneY}) rotate(${phoneRotate})`}>
              {phoneGlow > 0 ? (
                <circle cx="0" cy="0" r="64" fill="url(#sam-phone-glow)" opacity={phoneGlow} />
              ) : null}
              <rect x="-17" y="-31" width="34" height="62" rx="7" fill={paper.outline} />
              <rect x="-13" y="-27" width="26" height="52" rx="4" fill={paper.mint} />
              <rect x="-9" y="-21" width="18" height="7" rx="2" fill={paper.green} opacity="0.75" />
              <rect x="-9" y="-10" width="18" height="20" rx="2" fill={paper.white} opacity="0.9" />
              <rect x="-9" y="14" width="18" height="5" rx="2" fill={paper.green} opacity="0.6" />
            </g>
          ) : null}
          <circle
            cx={pose === 'point' ? 226 : pose === 'phone' ? 158 : pose === 'inspect' ? 146 : pose === 'cheer' ? 160 : 166}
            cy={pose === 'point' ? 190 : pose === 'phone' ? 246 : pose === 'inspect' ? 274 : pose === 'cheer' ? 112 : 282}
            r="10"
            fill={paper.skin}
            stroke={paper.outline}
            strokeWidth="2.4"
          />

          {/* neck + head */}
          <path d="M108 150 L108 170 L132 170 L132 150 Z" fill={paper.skinShade} stroke={paper.outline} strokeWidth="2" />
          <g transform={`rotate(${Math.sin(t * 1.2 + seed) * 1.2} 120 110)`}>
            <path
              d="M120 44 C160 44 176 74 174 108 C172 144 150 166 120 166 C90 166 68 144 66 108 C64 74 80 44 120 44 Z"
              fill={paper.skin}
              stroke={paper.outline}
              strokeWidth="3.2"
            />
            <path
              d="M68 106 C60 70 84 40 120 40 C156 40 180 68 172 106 C162 92 154 80 144 76 C130 88 104 90 86 82 C78 88 72 96 68 106 Z"
              fill={paper.hair}
              stroke={paper.outline}
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <path d="M70 102 C74 80 92 62 116 58" fill="none" stroke={paper.hairLight} strokeWidth="5" strokeLinecap="round" opacity="0.7" />
            <path d="M64 112 C56 110 54 124 62 128" fill={paper.skinShade} stroke={paper.outline} strokeWidth="2.2" />
            <path d="M176 112 C184 110 186 124 178 128" fill={paper.skinShade} stroke={paper.outline} strokeWidth="2.2" />
            <g transform={`translate(0 ${(1 - blink) * 3}) scale(1 ${blink})`} style={{ transformOrigin: '100px 112px' }}>
              <ellipse cx="100" cy="112" rx="4.2" ry="5.4" fill={paper.outline} />
              <circle cx="101.5" cy="110.5" r="1.3" fill={paper.white} />
            </g>
            <g transform={`translate(0 ${(1 - blink) * 3}) scale(1 ${blink})`} style={{ transformOrigin: '140px 112px' }}>
              <ellipse cx="140" cy="112" rx="4.2" ry="5.4" fill={paper.outline} />
              <circle cx="141.5" cy="110.5" r="1.3" fill={paper.white} />
            </g>
            <path d="M90 100 C96 96 104 96 110 100" fill="none" stroke={paper.outline} strokeWidth="2.6" strokeLinecap="round" />
            <path d="M130 100 C136 96 144 96 150 100" fill="none" stroke={paper.outline} strokeWidth="2.6" strokeLinecap="round" />
            <path d="M120 116 L117 130 L124 130" fill="none" stroke={paper.skinShade} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M106 144 C114 151 126 151 134 144" fill="none" stroke={paper.outline} strokeWidth="2.8" strokeLinecap="round" />
            <ellipse cx="86" cy="132" rx="8" ry="4" fill={paper.red} opacity="0.18" />
            <ellipse cx="154" cy="132" rx="8" ry="4" fill={paper.red} opacity="0.18" />
          </g>

          <ellipse cx="120" cy="410" rx="62" ry="7" fill={paper.outline} opacity="0.12" />
        </g>
      </svg>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.16, mixBlendMode: 'multiply', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27120%27 height=%27120%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.8%27 numOctaves=%272%27/%3E%3C/filter%3E%3Crect width=%27120%27 height=%27120%27 filter=%27url(%23n)%27 opacity=%270.5%27/%3E%3C/svg%3E")' }} />
    </div>
  );
};

export type StickRole =
  | 'neighbor'
  | 'steward'
  | 'contractor'
  | 'inspector'
  | 'bidder'
  | 'council'
  | 'cyclist'
  | 'resident';

type StickFigureProps = {
  role?: StickRole;
  pose?: 'stand' | 'walk' | 'wave' | 'point' | 'clipboard' | 'vote' | 'cheer' | 'ride';
  scale?: number;
  flip?: boolean;
  accent?: string;
  seed?: number;
  style?: CSSProperties;
  label?: string;
};

const roleAccent: Record<StickRole, string> = {
  neighbor: paper.amber,
  steward: paper.jacket,
  contractor: paper.amber,
  inspector: paper.blue,
  bidder: paper.red,
  council: paper.jacket,
  cyclist: paper.mint,
  resident: paper.blue,
};

const roleLabel: Record<StickRole, string> = {
  neighbor: 'Neighbor',
  steward: 'Steward',
  contractor: 'Contractor',
  inspector: 'Inspector',
  bidder: 'Bidder',
  council: 'Council',
  cyclist: 'Cyclist',
  resident: 'Resident',
};

/**
 * Stick-figure supporting cast with paper heads and role-specific props.
 * Supporting characters are deliberately simpler than Sam so the paper-cut
 * hero reads first.
 */
export const StickFigure: React.FC<StickFigureProps> = ({
  role = 'neighbor',
  pose = 'stand',
  scale = 1,
  flip = false,
  accent,
  seed = 0,
  style,
  label,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const color = accent ?? roleAccent[role];
  const bob = Math.sin(t * 3 + seed) * 2.6;
  const walking = pose === 'walk' || pose === 'ride';
  const swing = walking ? Math.sin(t * 6 + seed) * 15 : Math.sin(t * 1.4 + seed) * 2;
  const wave = pose === 'wave' ? Math.sin(t * 7 + seed) * 18 : 0;
  const headY = role === 'cyclist' ? 104 : 92;

  const armRight =
    pose === 'wave'
      ? `M156 190 L184 154 L${196 + wave * 0.2} ${128 - wave * 0.1}`
      : pose === 'point'
        ? 'M156 190 L198 202 L222 188'
        : pose === 'vote'
          ? 'M156 190 L186 168 L180 140'
          : pose === 'clipboard'
            ? 'M156 190 L180 226 L160 250'
            : pose === 'cheer'
              ? 'M156 190 L182 144 L164 112'
              : 'M156 190 L176 238 L170 284';
  const armLeft =
    pose === 'clipboard'
      ? 'M84 190 L66 236 L90 262'
      : pose === 'cheer'
        ? 'M84 190 L58 144 L76 112'
        : pose === 'vote'
          ? 'M84 190 L54 168 L60 140'
          : 'M84 190 L64 238 L70 284';

  const width = 240 * scale;
  const height = 430 * scale;

  return (
    <div
      style={{
        position: 'absolute',
        width,
        height,
        filter: 'drop-shadow(0 14px 30px rgba(7, 27, 21, 0.18))',
        transform: `scaleX(${flip ? -1 : 1})`,
        ...style,
      }}
      aria-label={label ?? roleLabel[role]}
    >
      <svg viewBox="0 0 240 430" width="100%" height="100%" style={{ overflow: 'visible' }}>
        <g transform={`translate(0 ${bob})`}>
          <ellipse cx="120" cy="408" rx="56" ry="10" fill={paper.outline} opacity="0.16" />

          {/* legs */}
          <g transform={`rotate(${swing} 104 292)`}>
            <path d="M104 292 L96 350 L88 392" fill="none" stroke={paper.outline} strokeWidth="13" strokeLinecap="round" />
            <path d="M104 292 L96 350 L88 392" fill="none" stroke={paper.pants} strokeWidth="8" strokeLinecap="round" />
            <path d="M80 394 L104 394" fill="none" stroke={paper.outline} strokeWidth="12" strokeLinecap="round" />
          </g>
          <g transform={`rotate(${-swing} 136 292)`}>
            <path d="M136 292 L144 350 L152 392" fill="none" stroke={paper.outline} strokeWidth="13" strokeLinecap="round" />
            <path d="M136 292 L144 350 L152 392" fill="none" stroke={paper.pants} strokeWidth="8" strokeLinecap="round" />
            <path d="M136 394 L160 394" fill="none" stroke={paper.outline} strokeWidth="12" strokeLinecap="round" />
          </g>

          {/* torso line */}
          <path d="M120 166 L120 300" fill="none" stroke={paper.outline} strokeWidth="12" strokeLinecap="round" />
          <path d="M120 168 L120 298" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" opacity="0.85" />

          {/* arms */}
          <path d={armLeft} fill="none" stroke={paper.outline} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
          <path d={armLeft} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d={armRight} fill="none" stroke={paper.outline} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
          <path d={armRight} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />

          {/* paper head */}
          <circle cx="120" cy={headY} r="42" fill={paper.skin} stroke={paper.outline} strokeWidth="3" />
          <path
            d={`M80 ${headY - 12} C80 ${headY - 44} 160 ${headY - 44} 160 ${headY - 12} C150 ${headY - 28} 138 ${headY - 34} 120 ${headY - 34} C102 ${headY - 34} 90 ${headY - 28} 80 ${headY - 12} Z`}
            fill={role === 'inspector' || role === 'contractor' ? color : paper.hair}
            stroke={paper.outline}
            strokeWidth="2.4"
          />
          <circle cx="106" cy={headY + 2} r="3.4" fill={paper.outline} />
          <circle cx="134" cy={headY + 2} r="3.4" fill={paper.outline} />
          <path d={`M108 ${headY + 20} C114 ${headY + 25} 126 ${headY + 25} 132 ${headY + 20}`} fill="none" stroke={paper.outline} strokeWidth="2.4" strokeLinecap="round" />

          {/* role props */}
          {role === 'neighbor' ? (
            <>
              <circle cx="152" cy={headY - 34} r="12" fill={paper.hair} stroke={paper.outline} strokeWidth="2" />
              <path d="M84 206 C96 214 144 214 156 206 L150 286 C132 294 108 294 90 286 Z" fill={color} opacity="0.28" />
              <rect x="168" y="236" width="26" height="34" rx="4" fill={paper.amberDeep} stroke={paper.outline} strokeWidth="2" />
            </>
          ) : null}
          {role === 'steward' ? (
            <>
              <path d="M120 166 L112 196 L120 208 L128 196 Z" fill={paper.shirt} stroke={paper.outline} strokeWidth="2" />
              <path d="M120 196 L120 244" stroke={paper.amber} strokeWidth="5" strokeLinecap="round" />
              <g transform="translate(164 226) rotate(-6)">
                <rect x="0" y="0" width="38" height="50" rx="3" fill={paper.card} stroke={paper.outline} strokeWidth="2" />
                <path d="M8 12 h22 M8 20 h18 M8 28 h20" stroke={paper.cardLine} strokeWidth="3" strokeLinecap="round" />
                <path d="M8 40 l5 5 l10 -12" fill="none" stroke={paper.jacket} strokeWidth="3" strokeLinecap="round" />
              </g>
            </>
          ) : null}
          {role === 'contractor' ? (
            <>
              <path d={`M78 ${headY - 18} C84 ${headY - 48} 156 ${headY - 48} 162 ${headY - 18} Z`} fill={paper.amber} stroke={paper.outline} strokeWidth="2.6" />
              <rect x="72" y={headY - 20} width="96" height="9" rx="4" fill={paper.amberDeep} stroke={paper.outline} strokeWidth="2" />
              <path d="M90 210 L120 226 L150 210 L146 278 L120 290 L94 278 Z" fill={paper.mint} opacity="0.32" />
              <path d="M102 210 L102 282 M138 210 L138 282" stroke={paper.white} strokeWidth="5" opacity="0.65" />
              <path d="M170 250 l18 -18 l12 12 l-18 18 z" fill={paper.cardLine} stroke={paper.outline} strokeWidth="2" />
            </>
          ) : null}
          {role === 'inspector' ? (
            <>
              <path d={`M78 ${headY - 22} C82 ${headY - 48} 158 ${headY - 48} 162 ${headY - 22} Z`} fill={paper.blue} stroke={paper.outline} strokeWidth="2.6" />
              <rect x="72" y={headY - 24} width="96" height="8" rx="4" fill={paper.blue} stroke={paper.outline} strokeWidth="2" />
              <g transform="translate(152 214) rotate(7)">
                <rect x="0" y="0" width="44" height="58" rx="3" fill={paper.card} stroke={paper.outline} strokeWidth="2" />
                <path d="M8 14 h28 M8 24 h24 M8 34 h26" stroke={paper.cardLine} strokeWidth="3" strokeLinecap="round" />
                <path d="M10 46 l5 5 l10 -12" fill="none" stroke={paper.jacket} strokeWidth="3.4" strokeLinecap="round" />
              </g>
            </>
          ) : null}
          {role === 'bidder' ? (
            <>
              <path d="M120 166 L112 198 L120 212 L128 198 Z" fill={paper.shirt} stroke={paper.outline} strokeWidth="2" />
              <path d="M120 198 L120 238" stroke={paper.red} strokeWidth="5" strokeLinecap="round" />
              <g transform="translate(162 224) rotate(-8)">
                <rect x="0" y="0" width="48" height="32" rx="2" fill={paper.card} stroke={paper.outline} strokeWidth="2" />
                <path d="M0 2 L24 20 L48 2" fill="none" stroke={paper.outline} strokeWidth="2" />
              </g>
            </>
          ) : null}
          {role === 'council' ? (
            <>
              <path d="M120 166 L112 196 L120 208 L128 196 Z" fill={paper.shirt} stroke={paper.outline} strokeWidth="2" />
              <path d="M120 196 L120 242" stroke={paper.jacket} strokeWidth="5" strokeLinecap="round" />
              <g transform="translate(166 222) rotate(10)">
                <rect x="0" y="0" width="34" height="44" rx="3" fill={paper.mintSoft ?? paper.card} stroke={paper.outline} strokeWidth="2" />
                <path d="M9 30 l6 6 l13 -17" fill="none" stroke={paper.jacket} strokeWidth="4" strokeLinecap="round" />
              </g>
            </>
          ) : null}
          {role === 'cyclist' ? (
            <>
              <circle cx="72" cy="356" r="34" fill="none" stroke={paper.outline} strokeWidth="7" />
              <circle cx="72" cy="356" r="34" fill="none" stroke={paper.mint} strokeWidth="3" />
              <circle cx="168" cy="356" r="34" fill="none" stroke={paper.outline} strokeWidth="7" />
              <circle cx="168" cy="356" r="34" fill="none" stroke={paper.mint} strokeWidth="3" />
              <path d="M72 356 L112 320 L150 320 L168 356 M112 320 L124 356" fill="none" stroke={paper.outline} strokeWidth="5" strokeLinecap="round" />
              <path d={`M78 ${headY - 16} C84 ${headY - 44} 156 ${headY - 44} 162 ${headY - 16} Z`} fill={paper.mint} stroke={paper.outline} strokeWidth="2.4" />
            </>
          ) : null}
          {role === 'resident' ? (
            <path d="M90 210 C104 218 136 218 150 210 L146 280 L120 292 L94 280 Z" fill={color} opacity="0.28" />
          ) : null}
        </g>
      </svg>
    </div>
  );
};

type PotholeProps = {
  variant?: 'open' | 'patched' | 'fixed';
  scale?: number;
  style?: CSSProperties;
  label?: string;
};

/** Paper-cut road plate with an open, patched or fixed pothole. */
export const Pothole: React.FC<PotholeProps> = ({
  variant = 'open',
  scale = 1,
  style,
  label,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const ripple = (Math.sin(t * 2.4) + 1) / 2;
  const width = 760 * scale;
  const height = 320 * scale;
  const fixed = variant === 'fixed';
  const patched = variant === 'patched';
  return (
    <div style={{ position: 'absolute', width, height, ...style }} aria-label={label ?? 'Pothole'}>
      <svg viewBox="0 0 760 320" width="100%" height="100%" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="road-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b4641" />
            <stop offset="55%" stopColor="#2c3632" />
            <stop offset="100%" stopColor="#202925" />
          </linearGradient>
          <radialGradient id="hole-grad" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#080d0b" />
            <stop offset="70%" stopColor="#111a16" />
            <stop offset="100%" stopColor="#1d2924" />
          </radialGradient>
          <filter id="road-shadow" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="14" stdDeviation="12" floodColor="#071b15" floodOpacity="0.35" />
          </filter>
        </defs>
        <path
          d="M18 46 L742 32 L754 270 L8 286 Z"
          fill="url(#road-grad)"
          stroke={paper.outline}
          strokeWidth="4"
          filter="url(#road-shadow)"
        />
        <path d="M28 56 L732 44" stroke="#5a6862" strokeWidth="3" opacity="0.35" />
        <path d="M24 262 L744 248" stroke="#151d1a" strokeWidth="5" opacity="0.6" />
        <path d="M0 168 L760 156" stroke={paper.amber} strokeWidth="4" strokeDasharray="42 34" opacity={fixed ? 0.5 : 0.75} />

        {fixed ? (
          <>
            <path
              d="M252 132 C322 104 444 106 514 134 C538 176 526 224 486 244 C404 270 312 262 264 232 C234 204 232 160 252 132 Z"
              fill="#495750"
              stroke={paper.mint}
              strokeWidth="4"
            />
            <path d="M270 148 C334 126 430 128 496 150" fill="none" stroke="#6c7b73" strokeWidth="3" opacity="0.7" />
            <path d="M278 216 C342 238 430 238 490 214" fill="none" stroke="#26322d" strokeWidth="4" opacity="0.6" />
            <path d="M330 178 l22 8 l-6 22 l-22 -8 z" fill={paper.mint} opacity="0.18" />
          </>
        ) : (
          <>
            <path
              d="M238 128 C300 92 438 96 516 130 C552 174 540 236 488 258 C402 286 300 272 252 238 C218 206 214 158 238 128 Z"
              fill="url(#hole-grad)"
              stroke={paper.outline}
              strokeWidth="5"
            />
            <path
              d="M262 146 C322 118 430 120 494 148"
              fill="none"
              stroke="#4b5a53"
              strokeWidth="3"
              opacity="0.55"
            />
            <path
              d="M250 222 C300 246 430 252 496 226"
              fill="none"
              stroke="#0b1210"
              strokeWidth="6"
              opacity="0.8"
            />
            <path d="M274 136 L250 112 L238 126 M508 138 L532 114 L546 132 M278 244 L252 264 M500 246 L526 266" fill="none" stroke="#141d19" strokeWidth="4" strokeLinecap="round" />
            <ellipse cx="390" cy="200" rx="86" ry="26" fill="#2f5c85" opacity={patched ? 0.25 : 0.2 + ripple * 0.1} />
            <path d="M342 198 C366 188 412 188 438 198" fill="none" stroke={paper.mint} strokeWidth="2.4" opacity={0.25 + ripple * 0.2} />
            {patched ? (
              <path d="M286 158 C348 132 436 134 492 158 L480 218 C420 238 338 236 292 214 Z" fill="#4b5a53" opacity="0.85" stroke={paper.mint} strokeWidth="3" />
            ) : null}
          </>
        )}

        {/* cone */}
        <g transform="translate(596 118) rotate(4)">
          <path d="M28 0 L50 78 L6 78 Z" fill={paper.amber} stroke={paper.outline} strokeWidth="3" />
          <path d="M22 28 L56 28 L60 44 L18 44 Z" fill={paper.white} opacity="0.85" />
          <rect x="0" y="78" width="56" height="10" rx="3" fill={paper.amberDeep} stroke={paper.outline} strokeWidth="2" />
        </g>
        <g transform="translate(94 220) rotate(-3)">
          <rect x="0" y="0" width="96" height="26" rx="4" fill={paper.card} stroke={paper.outline} strokeWidth="2" />
          <path d="M10 9 h66 M10 17 h48" stroke={paper.cardLine} strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
};

type PhonePropProps = {
  flash?: number;
  scale?: number;
  style?: CSSProperties;
  screen?: 'report' | 'case' | 'passport';
};

/** Paper phone with a simplified MEND screen and a cue-driven flash. */
export const PhoneProp: React.FC<PhonePropProps> = ({
  flash = 0,
  scale = 1,
  style,
  screen = 'report',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const width = 260 * scale;
  const height = 520 * scale;
  return (
    <div style={{ position: 'absolute', width, height, ...style }} aria-label="MEND phone">
      <svg viewBox="0 0 260 520" width="100%" height="100%" style={{ overflow: 'visible' }}>
        <defs>
          <radialGradient id="phone-flash" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="35%" stopColor={paper.mint} stopOpacity="0.8" />
            <stop offset="100%" stopColor={paper.mint} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="phone-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#20312a" />
            <stop offset="100%" stopColor="#0a1611" />
          </linearGradient>
        </defs>
        {flash > 0 ? <circle cx="130" cy="260" r={210 * flash} fill="url(#phone-flash)" opacity={0.75 * flash} /> : null}
        <rect x="18" y="8" width="224" height="496" rx="38" fill="url(#phone-body)" stroke={paper.outline} strokeWidth="4" />
        <rect x="30" y="22" width="200" height="468" rx="30" fill={paper.card} />
        <rect x="92" y="30" width="76" height="10" rx="5" fill={paper.outline} opacity="0.7" />
        <text x="46" y="72" fill={paper.outline} fontFamily="ui-monospace, monospace" fontSize="12" fontWeight="700">9:41</text>
        <rect x="174" y="64" width="28" height="10" rx="3" fill={paper.outline} opacity="0.35" />
        <rect x="46" y="96" width="168" height="34" rx="8" fill={paper.jacket} />
        <path d="M58 113 h10 l4 -10 l5 20 l4 -10 h10" fill="none" stroke={paper.mint} strokeWidth="3" strokeLinecap="round" />
        <text x="102" y="118" fill={paper.white} fontFamily="ui-monospace, monospace" fontSize="13" fontWeight="700" letterSpacing="2">MEND</text>
        <text x="46" y="164" fill={paper.outline} fontFamily="Georgia, serif" fontSize="24" fontWeight="700">
          {screen === 'case' ? 'Work order' : screen === 'passport' ? 'Passport' : 'Report it'}
        </text>
        <text x="46" y="188" fill={paper.muted} fontFamily="-apple-system, sans-serif" fontSize="12">
          {screen === 'case' ? 'Pothole · Riverside path' : screen === 'passport' ? 'One asset. One record.' : 'Photo, pin, one sentence.'}
        </text>
        <rect x="46" y="208" width="168" height="118" rx="12" fill={paper.cardLine} opacity="0.55" />
        <path d="M62 300 C84 264 106 284 122 258 C138 232 160 254 176 238 L198 300 Z" fill={paper.green} opacity="0.55" />
        <circle cx="184" cy="232" r="12" fill={paper.amber} opacity="0.8" />
        <rect x="46" y="342" width="168" height="12" rx="6" fill={paper.cardLine} />
        <rect x="46" y="364" width="126" height="12" rx="6" fill={paper.cardLine} />
        <rect x="46" y="398" width="168" height="38" rx="10" fill={paper.jacket} />
        <text x="90" y="422" fill={paper.white} fontFamily="-apple-system, sans-serif" fontSize="13" fontWeight="700">
          {screen === 'case' ? 'View receipt' : screen === 'passport' ? 'Open history' : 'Send report'}
        </text>
        <g opacity={0.65 + Math.sin(t * 2) * 0.1}>
          <circle cx="130" cy="468" r="14" fill={paper.green} />
          <path d="M123 468 l5 5 l10 -11" fill="none" stroke={paper.mint} strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
};

type CouncilTableProps = {
  votes?: number;
  scale?: number;
  style?: CSSProperties;
};

/** Top-down council table with three seats and two-of-three vote marks. */
export const CouncilTable: React.FC<CouncilTableProps> = ({ votes = 0, scale = 1, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const width = 820 * scale;
  const height = 440 * scale;
  return (
    <div style={{ position: 'absolute', width, height, ...style }} aria-label="Council table">
      <svg viewBox="0 0 820 440" width="100%" height="100%" style={{ overflow: 'visible' }}>
        <ellipse cx="410" cy="238" rx="250" ry="118" fill={paper.outline} opacity="0.14" />
        <ellipse cx="410" cy="224" rx="244" ry="112" fill="#c9b895" stroke={paper.outline} strokeWidth="4" />
        <ellipse cx="410" cy="216" rx="226" ry="98" fill={paper.card} stroke={paper.outline} strokeWidth="2.4" />
        <ellipse cx="410" cy="216" rx="190" ry="76" fill="none" stroke={paper.cardLine} strokeWidth="2" strokeDasharray="7 7" />
        <path d="M290 196 C340 180 480 180 530 196" fill="none" stroke={paper.cardLine} strokeWidth="2" />
        <g transform="translate(310 190) rotate(-4)">
          <rect width="96" height="58" rx="3" fill={paper.white} stroke={paper.outline} strokeWidth="2" />
          <path d="M12 14 h58 M12 24 h44 M12 34 h52" stroke={paper.cardLine} strokeWidth="3" strokeLinecap="round" />
        </g>
        <g transform="translate(432 196) rotate(5)">
          <rect width="88" height="52" rx="3" fill={paper.white} stroke={paper.outline} strokeWidth="2" />
          <path d="M10 13 h56 M10 22 h40 M10 31 h48" stroke={paper.cardLine} strokeWidth="3" strokeLinecap="round" />
        </g>
        {[0, 1, 2].map((index) => {
          const angle = -Math.PI / 2 + (index - 1) * 0.72;
          const cx = 410 + Math.cos(angle) * 238;
          const cy = 218 + Math.sin(angle) * 152;
          const voted = index < votes;
          return (
            <g key={index} transform={`translate(${cx} ${cy})`}>
              <circle cx="0" cy="-10" r="34" fill={paper.skin} stroke={paper.outline} strokeWidth="3" />
              <path d="M-32 -18 C-30 -46 30 -46 32 -18 C18 -32 -18 -32 -32 -18 Z" fill={paper.hair} stroke={paper.outline} strokeWidth="2.2" />
              <circle cx="-10" cy="-10" r="3" fill={paper.outline} />
              <circle cx="10" cy="-10" r="3" fill={paper.outline} />
              <path d="M-8 2 C-3 6 3 6 8 2" fill="none" stroke={paper.outline} strokeWidth="2.2" strokeLinecap="round" />
              <path d="M0 24 L0 70" stroke={paper.jacket} strokeWidth="10" strokeLinecap="round" />
              <path d="M0 38 L-24 58 M0 38 L24 58" stroke={paper.jacket} strokeWidth="7" strokeLinecap="round" />
              <g transform={`translate(22 28) rotate(${voted ? 0 : -8})`} opacity={voted ? 1 : 0.55}>
                <rect x="0" y="0" width="36" height="44" rx="3" fill={voted ? paper.mintSoft ?? paper.mint : paper.white} stroke={paper.outline} strokeWidth="2" />
                {voted ? (
                  <path d="M9 28 l6 6 l13 -17" fill="none" stroke={paper.jacket} strokeWidth="4" strokeLinecap="round" />
                ) : (
                  <circle cx="18" cy="22" r="8" fill="none" stroke={paper.cardLine} strokeWidth="3" />
                )}
              </g>
              <circle cx="0" cy="-10" r="44" fill="none" stroke={voted ? paper.mint : paper.cardLine} strokeWidth="2.5" opacity={voted ? 0.55 + Math.sin(t * 3 + index) * 0.12 : 0.35} />
            </g>
          );
        })}
        <text x="410" y="420" textAnchor="middle" fill={paper.muted} fontFamily="ui-monospace, monospace" fontSize="14" letterSpacing="3">COUNCIL · 2 OF 3</text>
      </svg>
    </div>
  );
};

type PassportBookProps = {
  open?: number;
  scale?: number;
  style?: CSSProperties;
  stamps?: number;
};

/** Paper passport / work-order booklet that opens on cue. */
export const PassportBook: React.FC<PassportBookProps> = ({
  open = 1,
  scale = 1,
  style,
  stamps = 3,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const width = 620 * scale;
  const height = 400 * scale;
  const coverRotate = -18 * (1 - open);
  return (
    <div style={{ position: 'absolute', width, height, ...style }} aria-label="MEND passport">
      <svg viewBox="0 0 620 400" width="100%" height="100%" style={{ overflow: 'visible' }}>
        <ellipse cx="310" cy="366" rx="250" ry="22" fill={paper.outline} opacity="0.16" />
        <g transform={`translate(${310 - 250 * open} 20) rotate(${coverRotate} 250 180)`} opacity={0.4 + open * 0.6}>
          <rect x="0" y="0" width="250" height="340" rx="12" fill={paper.jacketDark} stroke={paper.outline} strokeWidth="4" />
          <rect x="14" y="14" width="222" height="312" rx="7" fill="none" stroke={paper.mint} strokeWidth="2" opacity="0.5" />
          <text x="125" y="150" textAnchor="middle" fill={paper.mint} fontFamily="Georgia, serif" fontSize="30" fontWeight="700" letterSpacing="6">MEND</text>
          <text x="125" y="180" textAnchor="middle" fill={paper.paper} fontFamily="ui-monospace, monospace" fontSize="11" letterSpacing="3">ASSET PASSPORT</text>
          <circle cx="125" cy="250" r="34" fill="none" stroke={paper.mint} strokeWidth="2" opacity="0.55" />
          <path d="M103 250 h12 l6 -16 l8 32 l6 -16 h12" fill="none" stroke={paper.mint} strokeWidth="3" strokeLinecap="round" />
        </g>
        <g transform={`translate(${310 - 40 * open} 30)`}>
          <rect x="0" y="0" width="290" height="330" rx="10" fill={paper.card} stroke={paper.outline} strokeWidth="4" />
          <rect x="16" y="16" width="258" height="298" rx="5" fill={paper.white} stroke={paper.cardLine} strokeWidth="2" />
          <text x="34" y="52" fill={paper.ink} fontFamily="Georgia, serif" fontSize="22" fontWeight="700">Riverside path</text>
          <text x="34" y="74" fill={paper.muted} fontFamily="ui-monospace, monospace" fontSize="10" letterSpacing="2">PATH-006 · WO-0002</text>
          <path d="M34 90 h220" stroke={paper.cardLine} strokeWidth="2" />
          {['Reported · Sam', 'Awarded · B', 'Repair · accepted', 'Warranty · 12 mo'].map((line, index) => (
            <g key={line} transform={`translate(34 ${112 + index * 38})`}>
              <circle cx="6" cy="-4" r="5" fill={index < stamps ? paper.green : paper.cardLine} />
              <text x="20" y="0" fill={paper.inkSoft} fontFamily="-apple-system, sans-serif" fontSize="12">{line}</text>
              <path d="M20 8 h196" stroke={paper.cardLine} strokeWidth="1.4" opacity="0.7" />
            </g>
          ))}
          <g transform={`translate(196 250) rotate(${-8 + Math.sin(t * 1.8) * 1.5})`} opacity={stamps > 2 ? 1 : 0.4}>
            <circle cx="0" cy="0" r="38" fill="none" stroke={paper.amber} strokeWidth="3" strokeDasharray="5 4" />
            <text x="0" y="-4" textAnchor="middle" fill={paper.amber} fontFamily="ui-monospace, monospace" fontSize="8" fontWeight="700">MEND</text>
            <text x="0" y="8" textAnchor="middle" fill={paper.amber} fontFamily="ui-monospace, monospace" fontSize="7">RECEIPT</text>
          </g>
        </g>
      </svg>
    </div>
  );
};
