'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { CaseBundle } from '@/lib/types';
import { isRevealed, statusLabel } from '@/lib/fixtures';
import { bpsToPercent, formatDateTime, microToUsdc, shortAccount, usdc } from '@/lib/format';
import { Badge, Callout, HashDisplay, PageHero, StatusPill } from '@/components/ui';
import { DataSourceNote } from '@/components/DataSourceNote';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Eye,
  Gavel,
  Lock,
  Scale,
  ShieldCheck,
  Users,
} from '@/components/Icons';

const EXPLANATIONS: Record<string, string> = {
  'BID-A-BENCH-001':
    'Competitive price, but the shortest warranty and slowest completion reduce total value.',
  'BID-B-BENCH-001':
    'Best overall value: lowest price among strong warranties, fastest completion and strong materials.',
  'BID-C-BENCH-001':
    'Lowest sticker price among the three, but the weakest warranty and slowest completion reduce total value.',
};

export function BidRoom({
  caseData,
  dataSource = 'fixture',
  apiConfigured = false,
  fallbackReason,
}: {
  caseData: CaseBundle;
  dataSource?: 'api' | 'fixture';
  apiConfigured?: boolean;
  fallbackReason?: string;
}) {
  const hasReveals = caseData.reveals.length > 0 && Boolean(caseData.score);
  const [showRevealed, setShowRevealed] = useState(hasReveals && isRevealed(caseData));
  const revealed = hasReveals && showRevealed;
  const winner = caseData.score?.ranking.find((bid) => bid.rank === 1);
  const awarded = isRevealed(caseData) && Boolean(caseData.contractorId);

  return (
    <div className="container">
      <PageHero
        eyebrow="Sealed contractor market"
        title="Offers stay sealed until the reveal window."
        lead="Contractors commit a hash first. Price, duration, warranty and materials are unreadable until reveal. After reveal, a hash-pinned WASM policy ranks total value — no LLM chooses the winner."
        aside={
          <div className="side-card">
            <h2>Work order</h2>
            <p className="side-card__value" style={{ fontSize: '1.15rem', fontFamily: 'var(--font-mono)' }}>
              {caseData.id}
            </p>
            <p className="side-card__note">{caseData.title}</p>
            <div style={{ marginTop: 10 }}>
              <StatusPill status={caseData.status} />
            </div>
            <div style={{ marginTop: 8 }}>
              <Badge tone={dataSource === 'api' && caseData.mode !== 'REPLAY' ? 'positive' : 'warning'}>
                {dataSource === 'api'
                  ? caseData.mode === 'REPLAY'
                    ? 'LIVE API · REPLAY RECORD'
                    : 'LIVE API'
                  : apiConfigured
                    ? 'REPLAY / SIMULATION · FIXTURE FALLBACK'
                    : 'REPLAY / SIMULATION'}
              </Badge>
            </div>
            <dl>
              <div>
                <dt>Budget</dt>
                <dd>{usdc(caseData.budgetMicro)}</dd>
              </div>
              <div>
                <dt>Commitments</dt>
                <dd>{caseData.commitments.length}</dd>
              </div>
              <div>
                <dt>Policy</dt>
                <dd>{caseData.policyVersion}</dd>
              </div>
            </dl>
          </div>
        }
      />

      <div className="bid-room" style={{ paddingBottom: 'clamp(50px, 8vw, 90px)' }}>
        <div className="phase-bar">
          <div className="phase-bar__phases" aria-label="Bidding phases">
            <span className={`phase${revealed ? ' is-done' : ' is-active'}`}>
              {revealed ? <Check size={13} /> : <Lock size={13} />} Commit
            </span>
            <span className={`phase${revealed ? ' is-done' : ''}`}>
              {revealed ? <Check size={13} /> : <Eye size={13} />} Reveal
            </span>
            <span className={`phase${revealed ? ' is-done' : ''}`}>
              <Scale size={13} /> Deterministic score
            </span>
            <span className={`phase${awarded ? ' is-done' : ''}`}>
              <Gavel size={13} /> Steward award
            </span>
          </div>
          {hasReveals ? (
            <button
              type="button"
              className="button button--small button--ghost"
              data-testid="bid-reveal-toggle"
              onClick={() => setShowRevealed((value) => !value)}
            >
              {revealed ? 'View sealed commitments only' : 'View revealed comparison'}
            </button>
          ) : (
            <Badge tone="warning">Recording ends before reveal</Badge>
          )}
        </div>

        <div className="sealed-note" role="note">
          <Lock size={17} aria-hidden="true" />
          <span>
            {revealed
              ? 'Reveal phase shown. Every revealed value below matched its earlier commitment hash and came from the approved roster. Availability is committed bid data, revealed with the rest of the offer.'
              : 'Sealed phase. Only commitment hashes and contractor accounts are visible. No price, availability, duration, warranty or material value is rendered in this view.'}
          </span>
        </div>

        <section className="panel" aria-labelledby="commitments-title">
          <div className="panel__head">
            <div>
              <p className="eyebrow">Commitments</p>
              <h2 id="commitments-title">{revealed ? 'Revealed offers' : 'Sealed offers'}</h2>
              <p>
                {revealed
                  ? 'The values below were sealed before the reveal deadline. The winner is determined by the published policy, not by preference.'
                  : 'A commitment is a one-way hash. It proves the bid existed; it does not reveal the bid before the allowed phase.'}
              </p>
            </div>
            <Badge tone={revealed ? 'positive' : 'warning'}>{revealed ? 'Revealed' : 'Sealed'}</Badge>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="sealed-table">
              <caption className="sr-only">
                {revealed ? 'Revealed contractor bids' : 'Sealed contractor bid commitments'}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Contractor</th>
                  <th scope="col">Bid ID</th>
                  <th scope="col">Commitment</th>
                  <th scope="col">Committed</th>
                  {revealed ? (
                    <>
                      <th scope="col">Price</th>
                      <th scope="col">
                        Availability
                        <span className="field__hint" style={{ display: 'block' }}>Committed bid data</span>
                      </th>
                      <th scope="col">Duration</th>
                      <th scope="col">Warranty</th>
                      <th scope="col">Materials</th>
                      <th scope="col">Checklist</th>
                    </>
                  ) : (
                    <th scope="col">Price · availability · duration · warranty</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {caseData.commitments.map((commitment) => {
                  const reveal = caseData.reveals.find((item) => item.bidId === commitment.bidId);
                  const isWinner = revealed && winner?.bidId === commitment.bidId;
                  return (
                    <tr key={commitment.bidId} className={isWinner ? 'score-row--winner' : undefined}>
                      <td>
                        <span className="mono">{shortAccount(commitment.contractorId)}</span>
                      </td>
                      <td>
                        <span className="mono">{commitment.bidId}</span>
                      </td>
                      <td>
                        <span className="sealed-value" title={commitment.commitmentHash}>
                          <Lock size={12} aria-hidden="true" /> {commitment.commitmentHash.slice(0, 10)}…
                        </span>
                      </td>
                      <td>{formatDateTime(commitment.committedAt)}</td>
                      {revealed && reveal ? (
                        <>
                          <td>
                            <strong>{usdc(reveal.priceMicro)}</strong>
                          </td>
                          <td>
                            Available in {reveal.availableInDays} {reveal.availableInDays === 1 ? 'day' : 'days'}
                            <span className="field__hint" style={{ display: 'block' }}>
                              Committed bid data
                            </span>
                          </td>
                          <td>{reveal.durationDays} days</td>
                          <td>{reveal.warrantyDays} days</td>
                          <td>
                            {reveal.materialsScore}/100
                            <span className="field__hint" style={{ display: 'block' }}>
                              {reveal.materials}
                            </span>
                          </td>
                          <td>{reveal.evidenceChecklistAccepted ? 'Accepted' : 'Not accepted'}</td>
                        </>
                      ) : (
                        <td>
                          <span className="sealed-value">
                            <Lock size={12} aria-hidden="true" /> SEALED
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {revealed ? (
            <p className="field__hint" style={{ marginTop: 10 }}>
              Availability is committed bid data: each contractor sealed it inside the commitment hash, and it is shown
              only after reveal. It is separate from the scoring inputs below.
            </p>
          ) : null}

          {!revealed && hasReveals ? (
            <div className="bid-actions">
              <button
                type="button"
                className="button button--small"
                data-testid="bid-reveal"
                onClick={() => setShowRevealed(true)}
              >
                Reveal comparison <Eye size={15} aria-hidden="true" />
              </button>
            </div>
          ) : null}

          {!hasReveals ? (
            <Callout
              tone="warning"
              title={dataSource === 'api' ? 'No public reveal yet' : 'No reveal in this recording'}
            >
              {dataSource === 'api'
                ? 'The live API has not published reveal values for this work order. The interface does not invent them.'
                : 'This work order is frozen at the sealed phase. The recording does not contain reveal values, so the interface does not invent them.'}{' '}
              Open the bench case to compare a completed reveal and deterministic score.
              <div style={{ marginTop: 10 }}>
                <Link className="text-link" href="/bids/WO-BENCH-001-0001">
                  Open the revealed bench market <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </Callout>
          ) : null}
        </section>

        {revealed && caseData.score ? (
          <>
            <section className="panel" aria-labelledby="score-title">
              <div className="panel__head">
                <div>
                  <p className="eyebrow">Deterministic evaluation</p>
                  <h2 id="score-title">Total value, not sticker price</h2>
                  <p>
                    Integer-only normalisation; price 45%, warranty 25%, duration 20%, materials 10%. The policy hash and
                    execution hashes are recorded with the result.
                  </p>
                </div>
                <Badge tone="warning">
                  {caseData.score.verified
                    ? 'Verified execution'
                    : caseData.mode === 'REPLAY'
                      ? 'Replay execution'
                      : 'Unverified execution'}
                </Badge>
              </div>

              <div className="weights" aria-label="Scoring policy weights">
                <div className="weight">
                  <span>Price</span>
                  <strong>{bpsToPercent(caseData.policyWeightsBps.price)}</strong>
                </div>
                <div className="weight">
                  <span>Warranty</span>
                  <strong>{bpsToPercent(caseData.policyWeightsBps.warranty)}</strong>
                </div>
                <div className="weight">
                  <span>Duration</span>
                  <strong>{bpsToPercent(caseData.policyWeightsBps.duration)}</strong>
                </div>
                <div className="weight">
                  <span>Materials</span>
                  <strong>{bpsToPercent(caseData.policyWeightsBps.materials)}</strong>
                </div>
              </div>

              <div style={{ overflowX: 'auto', marginTop: 18 }}>
                <table className="sealed-table score-table">
                  <caption className="sr-only">Deterministic score ranking</caption>
                  <thead>
                    <tr>
                      <th scope="col">Rank</th>
                      <th scope="col">Contractor</th>
                      <th scope="col">Price</th>
                      <th scope="col">
                        Availability
                        <span className="field__hint" style={{ display: 'block' }}>Committed bid data, not scored</span>
                      </th>
                      <th scope="col">Warranty</th>
                      <th scope="col">Duration</th>
                      <th scope="col">Materials</th>
                      <th scope="col">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caseData.score.ranking.map((bid) => (
                      <tr key={bid.bidId} className={bid.rank === 1 ? 'score-row--winner' : undefined}>
                        <td>
                          <span className="rank">{bid.rank}</span>
                        </td>
                        <td>
                          <span className="mono">{shortAccount(bid.contractorId)}</span>
                          {bid.rank === 1 ? (
                            <span className="field__hint" style={{ display: 'block' }}>
                              Rank 1 · steward confirmed
                            </span>
                          ) : null}
                        </td>
                        <td>${microToUsdc(bid.priceMicro, 0)}</td>
                        <td>
                          Available in {bid.availableInDays} {bid.availableInDays === 1 ? 'day' : 'days'}
                        </td>
                        <td>{bid.warrantyDays}d</td>
                        <td>{bid.durationDays}d</td>
                        <td>{bid.materialsScore}/100</td>
                        <td>
                          <div className="score-bar">
                            <div className="score-bar__track">
                              <div className="score-bar__fill" style={{ width: `${Math.min(100, bid.scoreBps / 100)}%` }} />
                            </div>
                            <span>{bid.scoreBps}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="hash-stack" style={{ marginTop: 16 }}>
                <HashDisplay value={caseData.score.policyHash} label="Policy hash" />
                <HashDisplay value={caseData.score.wasmHash} label="WASM hash" />
                <HashDisplay value={caseData.score.inputHash} label="Input hash" />
                <HashDisplay value={caseData.score.outputHash} label="Output hash" />
              </div>

              <ul className="explanation-list">
                {caseData.score.ranking.map((bid) => (
                  <li key={bid.bidId}>
                    <strong>#{bid.rank} · {shortAccount(bid.contractorId)}</strong> — {EXPLANATIONS[bid.bidId] ?? 'Structured value comparison.'}
                  </li>
                ))}
              </ul>

              <div className="rule-note">
                <strong>No LLM chooses the winner.</strong> A steward can confirm only the deterministic rank-1 eligible
                bid. Invalid, late or non-roster bids cannot win. The explanation text is constrained to structured values;
                it does not alter the ranking.
              </div>
              {caseData.score.unavailableReason ? (
                <p className="unavailable-reason">
                  <AlertTriangle size={14} aria-hidden="true" /> {caseData.score.unavailableReason}
                </p>
              ) : null}
            </section>

            <section className="panel" aria-labelledby="award-title">
              <div className="panel__head">
                <div>
                  <p className="eyebrow">Award</p>
                  <h2 id="award-title">{awarded ? 'Award confirmed by the steward' : 'Award not yet confirmed'}</h2>
                  <p>
                    {awarded
                      ? `${shortAccount(caseData.contractorId ?? '')} is the awarded contractor. The rank-1 bid locks ${usdc(caseData.winningBidMicro ?? '0')}; the unallocated budget returns to the sponsor.`
                      : 'The steward has not confirmed the rank-1 bid yet. No contractor is awarded.'}
                  </p>
                </div>
                <Badge tone={awarded ? 'positive' : 'neutral'}>
                  <Gavel size={14} aria-hidden="true" /> {awarded ? 'Awarded' : 'Pending'}
                </Badge>
              </div>
              <dl className="facts-grid">
                <div className="fact">
                  <dt>Winning bid</dt>
                  <dd>{caseData.winningBidMicro ? usdc(caseData.winningBidMicro) : 'Not awarded'}</dd>
                </div>
                <div className="fact">
                  <dt>Unawarded refund</dt>
                  <dd>{caseData.refundMicro ? usdc(caseData.refundMicro) : 'Pending'}</dd>
                </div>
                <div className="fact">
                  <dt>Completion (90%)</dt>
                  <dd>{caseData.completionPaymentMicro ? usdc(caseData.completionPaymentMicro) : 'Not paid'}</dd>
                </div>
                <div className="fact">
                  <dt>Durability holdback (10%)</dt>
                  <dd>{caseData.holdbackMicro ? usdc(caseData.holdbackMicro) : 'Not classified'}</dd>
                </div>
              </dl>
              <div className="form-actions">
                <Link className="button button--ghost button--small" href={`/cases/${caseData.id}`}>
                  Full case <ArrowRight size={15} aria-hidden="true" />
                </Link>
                <Link className="button button--small" href={`/inspector/${caseData.id}`}>
                  Inspector console <Users size={15} aria-hidden="true" />
                </Link>
              </div>
            </section>
          </>
        ) : null}

        <div className="card-grid">
          <article className="card">
            <span className="card__icon">
              <ShieldCheck size={20} />
            </span>
            <h3>Roster checked</h3>
            <p>
              Only the {caseData.daoApproval.contractorRoster.length} DAO-approved contractor accounts can commit. A
              non-roster bid is excluded before scoring.
            </p>
          </article>
          <article className="card">
            <span className="card__icon">
              <Lock size={20} />
            </span>
            <h3>Deadline checked</h3>
            <p>
              Early reveal, late reveal and hash mismatches fail. A late bid cannot be awarded even if its price is best.
            </p>
          </article>
          <article className="card">
            <span className="card__icon">
              <Scale size={20} />
            </span>
            <h3>Hash-bound result</h3>
            <p>
              The contract accepts only a score matching the work-order policy and the configured OutLayer callback. A
              mismatch is rejected.
            </p>
          </article>
        </div>

        <DataSourceNote
          source={dataSource}
          detail={
            fallbackReason ??
            `Sealed bid room for ${caseData.id} (${statusLabel(caseData.status)}). Frozen replay values are shown; no live reveal or OutLayer callback is claimed.`
          }
          liveDetail={`Sealed bid room for ${caseData.id} (${statusLabel(caseData.status)}). Data comes from the configured MEND API${
            caseData.mode === 'REPLAY' ? ' and is marked REPLAY / SIMULATION' : ''
          }. No OutLayer callback is claimed without a verified execution.`}
        />
      </div>
    </div>
  );
}
