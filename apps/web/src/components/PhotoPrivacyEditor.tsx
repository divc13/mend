'use client';

import { useCallback, useRef, useState } from 'react';
import { Camera, Check, X } from './Icons';

export interface PhotoPrivacyState {
  dataUrl: string | null;
  width: number;
  height: number;
  redactionCount: number;
  exifStripped: boolean;
  mediaHash?: string;
  fileName?: string;
}

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read that image.'));
    image.src = src;
  });
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

async function reencode(src: string): Promise<{ dataUrl: string; width: number; height: number }> {
  const image = await loadImage(src);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable in this browser.');
  context.drawImage(image, 0, 0, width, height);
  // A canvas re-encode drops EXIF, GPS, camera model and capture timestamp.
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), width, height };
}

async function flatten(src: string, boxes: Box[], width: number, height: number): Promise<string> {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable in this browser.');
  context.drawImage(image, 0, 0, width, height);
  context.fillStyle = '#101512';
  for (const box of boxes) {
    context.fillRect(box.x * width, box.y * height, box.w * width, box.h * height);
  }
  return canvas.toDataURL('image/jpeg', 0.9);
}

async function sha256Hex(dataUrl: string): Promise<string> {
  const response = await fetch(dataUrl);
  const buffer = await response.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function makeSamplePhoto(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 800;
  const context = canvas.getContext('2d');
  if (!context) return '';
  const sky = context.createLinearGradient(0, 0, 0, 800);
  sky.addColorStop(0, '#dce8e2');
  sky.addColorStop(1, '#e9e2cf');
  context.fillStyle = sky;
  context.fillRect(0, 0, 1200, 800);
  context.fillStyle = '#c6d5b8';
  context.beginPath();
  context.ellipse(220, 510, 330, 130, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#b7cba7';
  context.beginPath();
  context.ellipse(980, 490, 300, 120, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#8f8170';
  context.fillRect(0, 610, 1200, 190);
  context.fillStyle = '#7d6f5f';
  context.fillRect(0, 650, 1200, 150);
  // Bench
  context.fillStyle = '#5f4a35';
  context.fillRect(300, 430, 600, 46);
  context.fillStyle = '#74583d';
  context.fillRect(294, 476, 612, 22);
  context.fillStyle = '#4d3b2b';
  context.fillRect(345, 498, 26, 150);
  context.fillRect(829, 498, 26, 150);
  context.fillRect(330, 335, 540, 38);
  context.fillStyle = '#6a5138';
  context.fillRect(344, 373, 512, 18);
  // Split seat
  context.strokeStyle = '#2f2419';
  context.lineWidth = 8;
  context.beginPath();
  context.moveTo(620, 430);
  context.lineTo(650, 476);
  context.stroke();
  // Loose arm
  context.save();
  context.translate(880, 360);
  context.rotate(0.2);
  context.fillStyle = '#4d3b2b';
  context.fillRect(0, 0, 22, 130);
  context.restore();
  // A small redacted-looking sign to make the demo visible
  context.fillStyle = '#f6f1e5';
  context.fillRect(80, 90, 330, 96);
  context.fillStyle = '#2b4238';
  context.font = '700 28px Georgia';
  context.fillText('RIVERSIDE PARK', 102, 132);
  context.font = '22px sans-serif';
  context.fillStyle = '#62746b';
  context.fillText('Demo photo · no real metadata', 102, 164);
  return canvas.toDataURL('image/jpeg', 0.9);
}

export function PhotoPrivacyEditor({
  value,
  onChange,
}: {
  value: PhotoPrivacyState;
  onChange: (value: PhotoPrivacyState) => void;
}) {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [draft, setDraft] = useState<Omit<Box, 'id'> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(false);
  const [cleaned, setCleaned] = useState<{ dataUrl: string; width: number; height: number } | null>(
    value.dataUrl ? { dataUrl: value.dataUrl, width: value.width, height: value.height } : null,
  );
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; currentX: number; currentY: number } | null>(null);

  const emit = useCallback(
    async (dataUrl: string | null, redactionCount: number, width: number, height: number, hash?: string) => {
      onChange({
        dataUrl,
        width,
        height,
        redactionCount,
        exifStripped: Boolean(dataUrl),
        mediaHash: hash,
        fileName: value.fileName,
      });
    },
    [onChange, value.fileName],
  );

  const resetToClean = useCallback(async () => {
    if (!cleaned) return;
    const hash = await sha256Hex(cleaned.dataUrl);
    setApplied(false);
    await emit(cleaned.dataUrl, 0, cleaned.width, cleaned.height, hash);
  }, [cleaned, emit]);

  async function handleFile(file: File) {
    setBusy(true);
    setError('');
    try {
      const raw = await readFile(file);
      const clean = await reencode(raw);
      setCleaned(clean);
      setBoxes([]);
      setApplied(false);
      const hash = await sha256Hex(clean.dataUrl);
      onChange({
        dataUrl: clean.dataUrl,
        width: clean.width,
        height: clean.height,
        redactionCount: 0,
        exifStripped: true,
        mediaHash: hash,
        fileName: file.name,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not process that image.');
    } finally {
      setBusy(false);
    }
  }

  async function useSample() {
    setBusy(true);
    setError('');
    try {
      const raw = makeSamplePhoto();
      if (!raw) throw new Error('Canvas is unavailable in this browser.');
      const clean = await reencode(raw);
      setCleaned(clean);
      setBoxes([]);
      setApplied(false);
      const hash = await sha256Hex(clean.dataUrl);
      onChange({
        dataUrl: clean.dataUrl,
        width: clean.width,
        height: clean.height,
        redactionCount: 0,
        exifStripped: true,
        mediaHash: hash,
        fileName: 'riverside-demo.jpg',
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not build the demo photo.');
    } finally {
      setBusy(false);
    }
  }

  function pointerPosition(event: React.PointerEvent<HTMLDivElement>) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!cleaned || busy) return;
    const point = pointerPosition(event);
    dragRef.current = { x: point.x, y: point.y, currentX: point.x, currentY: point.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraft({ x: point.x, y: point.y, w: 0, h: 0 });
    setApplied(false);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const point = pointerPosition(event);
    dragRef.current = { ...dragRef.current, currentX: point.x, currentY: point.y };
    const x = Math.min(dragRef.current.x, point.x);
    const y = Math.min(dragRef.current.y, point.y);
    setDraft({
      x,
      y,
      w: Math.abs(point.x - dragRef.current.x),
      h: Math.abs(point.y - dragRef.current.y),
    });
  }

  function onPointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const x = Math.min(drag.x, drag.currentX);
    const y = Math.min(drag.y, drag.currentY);
    const w = Math.abs(drag.currentX - drag.x);
    const h = Math.abs(drag.currentY - drag.y);
    setDraft(null);
    if (w < 0.025 || h < 0.025) return;
    setBoxes((current) => [
      ...current,
      { id: `box-${Date.now()}-${current.length}`, x, y, w, h },
    ]);
    if (applied) void resetToClean();
  }

  function addKeyboardBox() {
    if (!cleaned) return;
    setBoxes((current) => [
      ...current,
      {
        id: `box-${Date.now()}-${current.length}`,
        x: 0.34,
        y: 0.34,
        w: 0.32,
        h: 0.18,
      },
    ]);
    setApplied(false);
    if (applied) void resetToClean();
  }

  async function applyRedactions() {
    if (!cleaned) return;
    setBusy(true);
    setError('');
    try {
      const next = boxes.length > 0 ? await flatten(cleaned.dataUrl, boxes, cleaned.width, cleaned.height) : cleaned.dataUrl;
      const hash = await sha256Hex(next);
      setApplied(boxes.length > 0);
      await emit(next, boxes.length, cleaned.width, cleaned.height, hash);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not apply the redactions.');
    } finally {
      setBusy(false);
    }
  }

  const display = value.dataUrl ? { ...value } : null;

  return (
    <div className="photo-editor">
      <div className="file-drop">
        <label className="file-drop__label" htmlFor="report-photo">
          <Camera size={18} aria-hidden="true" /> Choose a photo
        </label>
        <span className="field__hint">JPEG, PNG or WebP. The file is processed locally in this browser.</span>
        <input
          id="report-photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
          aria-describedby="photo-privacy-note"
        />
        <button type="button" className="button button--small button--ghost" onClick={() => void useSample()} disabled={busy}>
          Use demo photo
        </button>
      </div>

      <p id="photo-privacy-note" className="photo-tools__hint">
        Re-encoding removes EXIF/GPS. Drag on the preview to black out faces, plates or anything private. Keyboard users
        can add a centre redaction and remove it below.
      </p>

      <div
        ref={stageRef}
        className={`photo-stage${display ? '' : ' photo-stage--empty'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {display ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- local object preview, never sent to a tile server */}
            <img src={display.dataUrl ?? ''} alt="Redacted preview of the uploaded report photo" />
            {boxes.map((box) => (
              <span
                key={box.id}
                className="redact-box"
                style={{
                  left: `${box.x * 100}%`,
                  top: `${box.y * 100}%`,
                  width: `${box.w * 100}%`,
                  height: `${box.h * 100}%`,
                }}
              >
                <button
                  type="button"
                  className="redact-box__remove"
                  aria-label="Remove this redaction"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setBoxes((current) => current.filter((item) => item.id !== box.id));
                    setApplied(false);
                    if (applied) void resetToClean();
                  }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            {draft ? (
              <span
                className="redact-box"
                style={{
                  left: `${draft.x * 100}%`,
                  top: `${draft.y * 100}%`,
                  width: `${draft.w * 100}%`,
                  height: `${draft.h * 100}%`,
                }}
              />
            ) : null}
          </>
        ) : (
          <div className="photo-stage__empty">
            <Camera size={28} aria-hidden="true" />
            <strong>No photo yet</strong>
            <span>Choose a file above or use the demo photo.</span>
          </div>
        )}
      </div>

      {display ? (
        <>
          <div className="photo-tools">
            <button type="button" className="button button--small button--ghost" onClick={addKeyboardBox} disabled={busy}>
              Add redaction box
            </button>
            <button type="button" className="button button--small" onClick={() => void applyRedactions()} disabled={busy || boxes.length === 0}>
              <Check size={15} aria-hidden="true" /> Apply {boxes.length > 0 ? `${boxes.length} redaction${boxes.length === 1 ? '' : 's'}` : 'redactions'}
            </button>
            {boxes.length > 0 ? (
              <button
                type="button"
                className="button button--small button--ghost"
                onClick={() => {
                  setBoxes([]);
                  setApplied(false);
                  if (applied) void resetToClean();
                }}
                disabled={busy}
              >
                Clear all
              </button>
            ) : null}
            <span className="photo-tools__hint">
              {boxes.length === 0
                ? 'No redactions added.'
                : applied
                  ? 'Redactions are burned into the preview below.'
                  : 'Preview shows boxes. Apply to burn them into the outgoing image.'}
            </span>
          </div>
          <div className="photo-meta">
            <div className="photo-meta__item">
              <span>EXIF / GPS</span>
              <strong>{value.exifStripped ? 'Removed in browser' : 'Not removed'}</strong>
            </div>
            <div className="photo-meta__item">
              <span>Dimensions</span>
              <strong>
                {value.width} × {value.height}
              </strong>
            </div>
            <div className="photo-meta__item">
              <span>Redactions</span>
              <strong>{value.redactionCount}</strong>
            </div>
          </div>
          {value.mediaHash ? (
            <div className="hash-display" style={{ marginTop: 10 }}>
              <span className="hash-display__label">Redacted preview hash</span>
              <code title={value.mediaHash}>{value.mediaHash}</code>
            </div>
          ) : null}
        </>
      ) : null}

      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
      {busy ? <p className="field__hint" role="status">Processing image locally…</p> : null}
    </div>
  );
}
