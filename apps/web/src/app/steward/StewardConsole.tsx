'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { CaseBundle, WorkOrderState } from '@/lib/types';
import { statusLabel } from '@/lib/fixtures';
import { bpsToPercent, formatDateTime, microToUsdc, shortAccount, usdc } from '@/lib/format';
import { storeDemoIdentity } from '@/lib/api';
import { caseSourceLabel, caseSourceTone, type CaseDataSource } from '@/lib/case-source';
import { postWorkOrderAction, summarizeActionResult } from '@/lib/work-order-actions';
import { Badge, Callout, PageHero, StatusPill } from '@/components/ui';
import { DataSourceNote } from '@/components/DataSourceNote';
import { TxHashRow } from '@/components/TxHashRow';
import { useMode } from '@/components/ModeProvider';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  FileText,
  Gavel,
  Lock,
  Scale,
  ShieldCheck,
  Users,
} from '@/components/Icons';

const AWARDED_STATES: WorkOrderState[] = [
  'AWARDED',
  'IN_PROGRESS',
  'COMPLETION_SUBMITTED',
  'COMPLETION_ACCEPTED',
  'DURABILITY_PENDING',
  'CLOSED',
  'WARRANTY_REOPENED',
  'DISPUTED',
];

export function StewardConsole({
  cases,
  dataSource,
  apiConfigured,
  fallbackReason,
  initialCaseId,
}: {
  cases: CaseBundle[];
  dataSource: CaseDataSource;
  apiConfigured: boolean;
  fallbackReason?: string;
  initialCaseId?: string;
}) {
  const router = useRouter();
  const { mode, apiHealth } = useMode();
  const availableCases = cases.length > 0 ? cases : [];
  const firstCase = availableCases.find((item) => item.id === initialCaseId) ?? availableCases[0]!;
  const [caseId, setCaseId] = useState(firstCase.id);
  const caseData = availableCases.find((item) => item.id === caseId) ?? firstCase;
  const [scope, setScope] = useState(firstCase.scope);
  const [budget, setBudget] = useState(microToUsdc(firstCase.budgetMicro, 2));
  const [proposal, setProposal] = useState(firstCase.daoApproval.proposalId);
  const [acting, setActing] = useState(false);
  const [draftStatus, setDraftStatus] = useState('No local changes.');
  const [awardStatus, setAwardStatus] = useState<string | null>(null);
  const [awardTxHash, setAwardTxHash] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const live = mode === 'LIVE_TESTNET';
  const liveData = live && dataSource === 'api';
  const stewardAccount = apiHealth?.roleAccounts?.steward ?? 'mend-steward.testnet';
  const sourceLabel = caseSourceLabel(dataSource, caseData.mode, apiConfigured);

  const winner = useMemo(() => caseData.score?.ranking.find((bid) => bid.rank === 1), [caseData]);
  const alreadyAwarded = AWARDED_STATES.includes(caseData.status) && Boolean(caseData.contractorId);
  const canRehearseAward = Boolean(winner) && !alreadyAwarded;
  const canLiveAward = liveData && canRehearseAward && caseData.status === 'SCORED';
  const budgetMicro = useMemo(() => {
    const value = Number(budget);
    return Number.isFinite(value) && value >= 0 ? Math.round(value * 1_000_000) : 0;
  }, [budget]);
  const split = useMemo(() => {
    const award = caseData.winningBidMicro ? BigInt(caseData.winningBidMicro) : BigInt(budgetMicro);
    return { completion: (award * 9000n) / 10000n, holdback: award - (award * 9000n) / 10000n };
  }, [budgetMicro, caseData.winningBidMicro]);

  function chooseCase(nextId: string) {
    const next = availableCases.find((item) => item.id === nextId);
    if (!next) return;
    setCaseId(nextId);
    setScope(next.scope);
    setBudget(microToUsdc(next.budgetMicro, 2));
    setProposal(next.daoApproval.proposalId);
    setDraftStatus('No local changes.');
    setAwardStatus(null);
    setAwardTxHash(null);
  }

  function setActingRole(next: boolean) {
    setActing(next);
    if (!next || !live) return;
    const stored = storeDemoIdentity({ role: 'STEWARD', account: stewardAccount });
    if (!stored) {
      setDraftStatus(
        'Could not store the testnet-only STEWARD demo role in this browser. Live actions will not send a role header.',
      );
    }
  }

  async function confirmAward() {
    if (!winner) return;
    if (!liveData) {
      setAwardStatus(
        `Replay award confirmation for ${shortAccount(winner.contractorId)} recorded locally. No chain transaction, signature or escrow movement occurred.`,
      );
      return;
    }

    setSubmitting(true);
    const stored = storeDemoIdentity({ role: 'STEWARD', account: stewardAccount });
    if (!stored) {
      setAwardStatus(
        'The STEWARD demo role could not be stored in this browser. No API request was sent and no award is shown as applied.',
      );
      setSubmitting(false);
      return;
    }
    try {
      const result = await postWorkOrderAction(caseData.id, 'award', { bidId: winner.bidId });
      const summary = summarizeActionResult(result, 'award');
      setAwardStatus(
        `${summary.message}${summary.txHash ? ` Testnet transaction ${summary.txHash}.` : ''}`,
      );
      setAwardTxHash(summary.realTransaction && summary.txHash ? summary.txHash : null);
      if (summary.applied && summary.realTransaction) router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <PageHero
        eyebrow="Steward console"
        title="Human authority, visible at every step."
        lead="A steward edits the scope, sets the maximum budget and confirms the deterministic top-ranked eligible bid. The DAO authorizes the envelope and roster. AI may propose, but it cannot approve its own scope, contractor or payment."
        aside={
          <div className="side-card">
            <h2>{live ? 'Live testnet steward session' : 'Replay steward session'}</h2>
            <p className="side-card__value" style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)' }}>
              {live ? stewardAccount : 'steward.mend.testnet'}
            </p>
            <p className="side-card__note">
              {live
                ? 'Live actions call the same-origin API proxy with the testnet-only x-mend-role demo header. This is not a wallet signature. Test value only.'
                : 'No wallet is connected. This console demonstrates role gates and actions; it does not sign or submit a transaction.'}
            </p>
            <div style={{ marginTop: 8 }}>
              <Badge tone={caseSourceTone(dataSource, caseData.mode)}>{sourceLabel}</Badge>
            </div>
            <label className="checkbox-row" style={{ marginTop: 12 }}>
              <input
                type="checkbox"
                data-testid="steward-acting"
                checked={acting}
                onChange={(event) => setActingRole(event.target.checked)}
              />
              <span>
                {live
                  ? 'I am acting as the testnet steward. This stores the STEWARD demo role and enables API-backed actions; it is not a wallet signature.'
                  : 'I am acting as the steward in this replay and understand no transaction will be sent.'}
              </span>
            </label>
          </div>
        }
      />

      <div className="form-shell" style={{ paddingTop: 0 }}>
        <div className="form-main">
          <section className="form-card" aria-labelledby="steward-case-title">
            <div className="form-grid">
              <div className="field" style={{ marginTop: 0 }}>
                <label htmlFor="steward-case">Work order</label>
                <select
                  id="steward-case"
                  className="select"
                  data-testid="steward-case-select"
                  value={caseId}
                  onChange={(event) => chooseCase(event.target.value)}
                >
                  {availableCases.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id} — {statusLabel(item.status)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginTop: 0 }}>
                <span className="label">Current state</span>
                <div style={{ paddingTop: 8 }}>
                  <StatusPill status={caseData.status} />
                </div>
              </div>
            </div>
            <h2 id="steward-case-title" style={{ marginTop: 18 }}>
              Scope and budget
            </h2>
            <p>Only a human steward may approve this scope and maximum budget. The DAO envelope is attached separately.</p>

            <div className="field">
              <label htmlFor="steward-scope">Approved repair scope</label>
              <textarea
                id="steward-scope"
                className="textarea"
                value={scope}
                onChange={(event) => setScope(event.target.value)}
                aria-describedby="steward-scope-hint"
              />
              <span id="steward-scope-hint" className="field__hint">
                A live approval hashes this text and records the edit. AI-generated drafts must be explicitly edited by a
                human.
              </span>
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="steward-budget">Maximum budget (test USDC)</label>
                <input
                  id="steward-budget"
                  className="input"
                  inputMode="decimal"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  aria-describedby="steward-budget-hint"
                />
                <span id="steward-budget-hint" className="field__hint">
                  Envelope stays in escrow. Unallocated budget returns to the sponsor after award.
                </span>
              </div>
              <div className="field">
                <label htmlFor="steward-proposal">DAO proposal reference</label>
                <input
                  id="steward-proposal"
                  className="input"
                  inputMode="numeric"
                  value={proposal}
                  onChange={(event) => setProposal(event.target.value)}
                  aria-describedby="steward-proposal-hint"
                />
                <span id="steward-proposal-hint" className="field__hint">
                  A Sputnik FunctionCall proposal executes the authorization only after DAO approval.
                </span>
              </div>
            </div>

            <dl className="facts-grid" style={{ marginTop: 16 }}>
              <div className="fact">
                <dt>Budget entered</dt>
                <dd>{usdc(String(budgetMicro))}</dd>
              </div>
              <div className="fact">
                <dt>Winning award</dt>
                <dd>{caseData.winningBidMicro ? usdc(caseData.winningBidMicro) : 'Not awarded'}</dd>
              </div>
              <div className="fact">
                <dt>Completion 90%</dt>
                <dd>{usdc(split.completion)}</dd>
              </div>
              <div className="fact">
                <dt>Holdback 10%</dt>
                <dd>{usdc(split.holdback)}</dd>
              </div>
            </dl>

            <div className="form-actions">
              <span className="field__hint" role="status" aria-live="polite">
                {draftStatus}
              </span>
              <div className="form-actions__right">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => chooseCase(caseId)}
                  disabled={!acting}
                >
                  Reset form
                </button>
                <button
                  type="button"
                  className="button"
                  data-testid="steward-save-draft"
                  disabled={!acting}
                  onClick={() =>
                    setDraftStatus(
                      live
                        ? `Draft saved locally at ${formatDateTime(new Date().toISOString())}. The live API has no scope-edit endpoint in this build, so no scope hash changed and no transaction was sent.`
                        : `Replay draft saved locally at ${formatDateTime(new Date().toISOString())}. No transaction was sent and no scope hash changed.`,
                    )
                  }
                >
                  <FileText size={16} aria-hidden="true" /> {live ? 'Save local draft' : 'Save replay draft'}
                </button>
              </div>
            </div>
            {!acting ? (
              <p className="field__hint" role="status">
                {live
                  ? 'Confirm the steward role above to enable API-backed controls.'
                  : 'Confirm the steward role above to enable replay controls.'}
              </p>
            ) : null}
            {live && !liveData ? (
              <p className="field__hint" role="status">
                LIVE_TESTNET is selected, but this console is showing a replay fixture. API actions stay disabled.
              </p>
            ) : null}
          </section>

          <section className="form-card" aria-labelledby="dao-title">
            <div className="panel__head">
              <div>
                <p className="eyebrow">DAO authorization</p>
                <h2 id="dao-title">Envelope, roster and policy</h2>
                <p>
                  The DAO authorizes the budget envelope, contractor roster, inspector roster and bid-scoring policy. AI
                  cannot authorize its own scope or payment.
                </p>
              </div>
              <Badge tone={caseData.daoApproval.state === 'APPROVED' ? 'positive' : 'warning'}>
                {caseData.daoApproval.state} · #{caseData.daoApproval.proposalId}
              </Badge>
            </div>
            <dl className="facts-grid">
              <div className="fact">
                <dt>DAO account</dt>
                <dd className="mono">{shortAccount(caseData.daoApproval.daoAccount)}</dd>
              </div>
              <div className="fact">
                <dt>Approved budget</dt>
                <dd>{usdc(caseData.daoApproval.budgetMicro)}</dd>
              </div>
              <div className="fact">
                <dt>Approved at</dt>
                <dd>{caseData.daoApproval.approvedAt ? formatDateTime(caseData.daoApproval.approvedAt) : 'Not approved'}</dd>
              </div>
              <div className="fact">
                <dt>Policy version</dt>
                <dd>{caseData.policyVersion}</dd>
              </div>
            </dl>

            <h3 style={{ marginTop: 18, fontSize: '1rem' }}>Contractor roster</h3>
            <ul className="roster-list">
              {caseData.daoApproval.contractorRoster.map((account) => (
                <li key={account}>
                  <Check size={14} aria-hidden="true" />
                  <span className="mono">{account}</span>
                  {caseData.contractorId === account ? <Badge tone="positive">Awarded</Badge> : null}
                </li>
              ))}
            </ul>

            <h3 style={{ marginTop: 16, fontSize: '1rem' }}>Inspector roster</h3>
            <ul className="roster-list">
              {caseData.daoApproval.inspectorRoster.map((account) => (
                <li key={account}>
                  <Check size={14} aria-hidden="true" />
                  <span className="mono">{account}</span>
                  {caseData.inspectorId === account ? <Badge tone="active">Assigned</Badge> : null}
                </li>
              ))}
            </ul>

            <div className="weights">
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
            <div className="rule-note">
              Roster or policy changes require a new DAO approval. Editing this page does not change the on-chain roster.
            </div>
          </section>

          <section className="form-card" aria-labelledby="award-confirm-title">
            <div className="panel__head">
              <div>
                <p className="eyebrow">Award confirmation</p>
                <h2 id="award-confirm-title">Confirm only the deterministic rank-1 eligible bid</h2>
                <p>
                  The steward does not choose a winner. The published policy produces a ranking; the steward confirms its
                  top eligible entry.
                </p>
              </div>
              <Badge tone={alreadyAwarded ? 'positive' : winner ? 'warning' : 'neutral'}>
                <Gavel size={14} aria-hidden="true" /> {alreadyAwarded ? 'Awarded' : winner ? 'Ready' : 'No score'}
              </Badge>
            </div>

            {winner ? (
              <>
                <div className="score-table" style={{ overflowX: 'auto' }}>
                  <table className="sealed-table">
                    <caption className="sr-only">Deterministic ranking for {caseData.id}</caption>
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
                        <th scope="col">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {caseData.score?.ranking.map((bid) => (
                        <tr key={bid.bidId} className={bid.rank === 1 ? 'score-row--winner' : undefined}>
                          <td>
                            <span className="rank">{bid.rank}</span>
                          </td>
                          <td className="mono">{shortAccount(bid.contractorId)}</td>
                          <td>{usdc(bid.priceMicro)}</td>
                          <td>
                            Available in {bid.availableInDays} {bid.availableInDays === 1 ? 'day' : 'days'}
                          </td>
                          <td>{bid.warrantyDays}d</td>
                          <td>{bid.durationDays}d</td>
                          <td>{bid.scoreBps}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="form-actions">
                  <span className="field__hint" role="status" aria-live="polite">
                    {awardStatus ??
                      (alreadyAwarded
                        ? `Already awarded to ${shortAccount(caseData.contractorId ?? '')}. A closed or advanced work order cannot be re-awarded.`
                        : liveData
                          ? canLiveAward
                            ? 'The rank-1 bid is eligible. Confirming sends a testnet award through the API; it is only shown as applied when the API reports a real transaction hash.'
                            : `The live API can only award a SCORED work order. This case is ${statusLabel(caseData.status)}, so the action stays disabled.`
                          : 'The rank-1 bid is eligible. A steward confirmation would lock the award and return unallocated budget.')}
                  </span>
                  <div className="form-actions__right">
                    <Link className="button button--ghost button--small" href={`/bids/${caseData.id}`}>
                      Bid room <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      className="button button--small"
                      data-testid="steward-confirm-award"
                      disabled={submitting || !acting || (liveData ? !canLiveAward : !canRehearseAward)}
                      onClick={() => void confirmAward()}
                    >
                      <Gavel size={15} aria-hidden="true" />{' '}
                      {submitting ? 'Sending…' : liveData ? 'Confirm award on testnet' : 'Confirm award in replay'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <Callout tone="warning" title="No deterministic score">
                This work order has no eligible revealed score, so there is nothing to confirm. The steward cannot invent a
                winner.
              </Callout>
            )}
          </section>

          <DataSourceNote
            source={dataSource}
            detail={fallbackReason}
            liveDetail={`Steward console for ${caseData.id}. Case data is read from the configured MEND API. API-backed award actions are enabled only after the global mode banner verifies LIVE_TESTNET; the API data source alone does not enable them.`}
          />
        </div>

        <aside className="form-aside" aria-label="Role and transaction notes">
          <section className="side-card">
            <h2>Role requirements</h2>
            <ul className="decision-list" style={{ marginTop: 10 }}>
              <li>
                <Check size={15} aria-hidden="true" /> Steward: scope, budget, open/close bidding, award.
              </li>
              <li>
                <Check size={15} aria-hidden="true" /> DAO: envelope, roster, policy, dispute resolution.
              </li>
              <li>
                <AlertTriangle size={15} aria-hidden="true" /> AI: proposal only; no award or payment authority.
              </li>
              <li>
                <Lock size={15} aria-hidden="true" /> No wallet or key is present in this browser.
              </li>
            </ul>
          </section>
          <section className="side-card">
            <h2>Transaction status</h2>
            <div className="status-bars" style={{ marginTop: 8 }}>
              <div className="evidence-mix__row">
                <span>Scope draft</span>
                <Badge tone="warning">{live ? 'Local only' : 'Replay only'}</Badge>
              </div>
              <div className="evidence-mix__row">
                <span>DAO authorization</span>
                <Badge tone={caseData.daoApproval.state === 'APPROVED' ? 'positive' : 'warning'}>
                  {caseData.daoApproval.state}
                </Badge>
              </div>
              <div className="evidence-mix__row">
                <span>Award</span>
                <Badge tone={alreadyAwarded ? 'positive' : 'neutral'}>{alreadyAwarded ? 'Recorded' : 'Not awarded'}</Badge>
              </div>
              <div className="evidence-mix__row">
                <span>Explorer link</span>
                <Badge tone={awardTxHash ? 'positive' : 'warning'}>{awardTxHash ? 'Testnet tx' : 'None'}</Badge>
              </div>
            </div>
            {awardTxHash ? <TxHashRow hash={awardTxHash} label="Award transaction" compact /> : null}
            <p className="side-card__note" style={{ marginTop: 10 }}>
              No action on this page is shown as executed without a real transaction hash. Live actions use the
              testnet-only demo role header, not a wallet signature.
            </p>
          </section>
          <section className="side-card">
            <h2>Checks</h2>
            <ul className="decision-list" style={{ marginTop: 10 }}>
              <li>
                <ShieldCheck size={15} aria-hidden="true" /> Contractor ≠ inspector.
              </li>
              <li>
                <Users size={15} aria-hidden="true" /> Rosters are DAO-approved snapshots.
              </li>
              <li>
                <Scale size={15} aria-hidden="true" /> Policy hash pinned to the work order.
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
