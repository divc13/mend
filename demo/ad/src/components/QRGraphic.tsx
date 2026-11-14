import React, { useMemo } from 'react';
import QRCode from 'qrcode';
import { fonts, palette } from '../theme';

type QRGraphicProps = {
  value: string;
  size?: number;
  label?: string;
};

/**
 * A real, decodable QR code with a four-module quiet zone. The quiet zone is
 * part of the SVG viewBox so the code stays scannable at any rendered size.
 */
export const QRGraphic: React.FC<QRGraphicProps> = ({
  value,
  size = 150,
  label = 'SCAN TO TRY',
}) => {
  const qr = useMemo(() => QRCode.create(value, { errorCorrectionLevel: 'M' }), [value]);
  const modules = qr.modules.size;
  const data = qr.modules.data;
  const quiet = 4;
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < modules; y += 1) {
    for (let x = 0; x < modules; x += 1) {
      if (data[y * modules + x]) {
        cells.push(
          <rect key={`q-${x}-${y}`} x={x} y={y} width={1} height={1} fill={palette.ink} />,
        );
      }
    }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          backgroundColor: palette.surface,
          border: `1px solid ${palette.line}`,
          boxShadow: '0 14px 36px rgba(17, 34, 29, 0.12)',
          overflow: 'hidden',
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`${-quiet} ${-quiet} ${modules + quiet * 2} ${modules + quiet * 2}`}
          aria-label={`QR code for ${value}`}
          role="img"
        >
          <rect
            x={-quiet}
            y={-quiet}
            width={modules + quiet * 2}
            height={modules + quiet * 2}
            fill={palette.surface}
          />
          {cells}
        </svg>
      </div>
      <span
        style={{
          fontFamily: fonts.mono,
          fontSize: 11,
          letterSpacing: '0.16em',
          color: palette.muted,
        }}
      >
        {label}
      </span>
    </div>
  );
};
