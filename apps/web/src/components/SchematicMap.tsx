'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { statusLabel, statusTone } from '@/lib/fixtures';
import { usdc } from '@/lib/format';
import type { Asset, CaseBundle } from '@/lib/types';
import { ArrowRight, MapPin } from './Icons';
import { StatusPill } from './ui';

function position(asset: Asset) {
  const x = ((asset.publicLocation.coarseLng - 13.399) / 0.014) * 88 + 6;
  const y = 92 - ((asset.publicLocation.coarseLat - 52.515) / 0.009) * 82;
  return { left: `${Math.min(94, Math.max(6, x))}%`, top: `${Math.min(92, Math.max(8, y))}%` };
}

export function SchematicMap({ assets, cases }: { assets: Asset[]; cases: CaseBundle[] }) {
  const firstCase = cases[0];
  const [selectedId, setSelectedId] = useState<string>(firstCase?.id ?? '');

  const selected = useMemo(
    () => cases.find((item) => item.id === selectedId) ?? firstCase,
    [cases, firstCase, selectedId],
  );
  const selectedAsset = selected ? assets.find((asset) => asset.id === selected.assetId) : undefined;

  return (
    <div className="map-shell">
      <div className="map-frame">
        <div className="map-canvas" role="group" aria-label="Schematic map of public MEND assets. Coarse locations only.">
          <svg className="map-art" viewBox="0 0 100 70" aria-hidden="true" focusable="false" preserveAspectRatio="none">
            <rect width="100" height="70" fill="var(--map-ground)" />
            <path d="M-2 46 C 14 38, 24 52, 38 46 S 64 34, 82 42 S 96 50, 104 44" className="map-river" />
            <path d="M-2 46 C 14 38, 24 52, 38 46 S 64 34, 82 42 S 96 50, 104 44" className="map-river-bank" />
            <path d="M8 8 H42 V30 H8 Z" className="map-park" />
            <path d="M62 6 H93 V24 H62 Z" className="map-park map-park--soft" />
            <path d="M4 64 H92" className="map-road" />
            <path d="M56 2 V68" className="map-road map-road--thin" />
            <path d="M2 22 H98" className="map-road map-road--thin" />
            <path d="M18 2 V30 M76 24 V68" className="map-path" />
            <text x="11" y="14" className="map-label">
              RIVERSIDE PARK
            </text>
            <text x="58" y="12" className="map-label">
              COMMUNITY CENTRE
            </text>
            <text x="36" y="65" className="map-label map-label--muted">
              CANAL PATH
            </text>
            <text x="58" y="63" className="map-label map-label--muted map-label--vertical">
              EAST GATE
            </text>
          </svg>

          {assets.map((asset) => {
            const caseData = cases.find((item) => item.assetId === asset.id);
            if (!caseData) return null;
            const tone = statusTone(caseData.status);
            return (
              <button
                key={asset.id}
                type="button"
                className={`map-pin map-pin--${tone}${caseData.id === selectedId ? ' is-selected' : ''}`}
                style={position(asset)}
                aria-pressed={caseData.id === selectedId}
                aria-label={`${asset.id}, ${asset.publicLocation.area}: ${caseData.title}. ${statusLabel(caseData.status)}.`}
                onClick={() => setSelectedId(caseData.id)}
              >
                <span className="map-pin__dot" aria-hidden="true" />
                <span className="map-pin__label">{asset.id}</span>
              </button>
            );
          })}
        </div>

        <div className="map-legend" aria-label="Map legend">
          <span>
            <i className="legend-dot legend-dot--active" /> Active
          </span>
          <span>
            <i className="legend-dot legend-dot--positive" /> Closed
          </span>
          <span>
            <i className="legend-dot legend-dot--warning" /> Warranty / dispute
          </span>
          <span className="map-legend__note">Schematic, not to scale · coarse public location only</span>
        </div>
      </div>

      <div className="map-side">
        {selected && selectedAsset ? (
          <article className="map-card" aria-live="polite">
            <div className="map-card__top">
              <span className="map-card__pin">
                <MapPin size={15} />
              </span>
              <span className="mono">{selectedAsset.id}</span>
              <StatusPill status={selected.status} />
            </div>
            <h3>{selected.title}</h3>
            <p>{selectedAsset.publicLocation.label}</p>
            <dl className="map-card__facts">
              <div>
                <dt>Envelope</dt>
                <dd>{usdc(selected.budgetMicro)}</dd>
              </div>
              <div>
                <dt>Reports</dt>
                <dd>{selected.reports.length}</dd>
              </div>
              <div>
                <dt>Warranty</dt>
                <dd>{selected.warranty ? 'Reopened' : selected.status === 'CLOSED' ? 'Released' : 'Not started'}</dd>
              </div>
            </dl>
            <Link className="button button--small" href={`/cases/${selected.id}`}>
              Open case <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </article>
        ) : null}

        <ul className="map-list" aria-label="All public cases">
          {cases.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`map-list__button${item.id === selectedId ? ' is-selected' : ''}`}
                onClick={() => setSelectedId(item.id)}
                aria-pressed={item.id === selectedId}
              >
                <span className={`map-list__dot map-list__dot--${statusTone(item.status)}`} aria-hidden="true" />
                <span className="map-list__copy">
                  <span className="map-list__title">{item.title}</span>
                  <span className="map-list__meta">
                    {item.assetId} · {statusLabel(item.status)}
                  </span>
                </span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
