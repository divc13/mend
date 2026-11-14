'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { CaseBundle } from '@/lib/types';
import { formatDateTime, shortAccount, usdc } from '@/lib/format';
import { apiFetch, storeDemoIdentity } from '@/lib/api';
import { caseSourceLabel, caseSourceTone, type CaseDataSource } from '@/lib/case-source';
import { createInspection, postWorkOrderAction, sha256Hex, summarizeActionResult } from '@/lib/work-order-actions';
import { Badge, Callout, HashDisplay, PageHero } from '@/components/ui';
import { DataSourceNote } from '@/components/DataSourceNote';
import { TxHashRow } from '@/components/TxHashRow';
import { useMode } from '@/components/ModeProvider';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Eye,
  FileText,
  ImageIcon,
  Lock,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from '@/components/Icons';

type Decision = 'APPROVED' | 'REJECTED';

export function InspectorConsole({
  caseData,
  dataSource,
  apiConfigured,
  fallbackReason,
}: {
  caseData: CaseBundle;
  dataSource: CaseDataSource;
  apiConfigured: boolean;
  fallbackReason?: string;
}) {
  const router = useRouter();
  const { mode, apiHealth } = useMode();
  const evidence = caseData.evidence[caseData.evidence.length - 1];
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((evidence?.checklist ?? []).map((item) => [item.label, item.complete])),
  );
  const [confirmRole, setConfirmRole] = useState(false);
  const [confirmReviewed, setConfirmReviewed] = useState(false);
  const [confirmHuman, setConfirmHuman] = useState(false);
  const [notes, setNotes] = useState('');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionTxHash, setActionTxHash] = useState<string | null>(null);
  const [liveCounts, setLiveCounts] = useState<{
    commitments: number;
    reveals: number;
    evidence: number;
  } | null>(null);
  const [liveCountsError, setLiveCountsError] = useState<string | null>(null);

  const live = mode === 'LIVE_TESTNET';
  const liveData = live && dataSource === 'api';
  const sourceLabel = caseSourceLabel(dataSource, caseData.mode, apiConfigured);
  const inspectorAccount =
    caseData.inspectorId ?? apiHealth?.roleAccounts?.inspector ?? 'mend-inspector.testnet';

  useEffect(() => {
    if (dataSource !== 'api') return;
    let cancelled = false;
    const id = encodeURIComponent(caseData.id);

    void Promise.all([
      apiFetch<{ commitments?: unknown[]; reveals?: unknown[] }>(`/v1/work-orders/${id}/bids`),
      apiFetch<unknown[]>(`/v1/work-orders/${id}/evidence`),
    ]).then(([bids, packages]) => {
      if (cancelled) return;
      if (!bids.ok || !packages.ok) {
        setLiveCountsError(
          !bids.ok
            ? `Bids endpoint: ${bids.message}`
            : !packages.ok
              ? `Evidence endpoint: ${packages.message}`
              : null,
        );
        return;
      }
      setLiveCounts({
        commitments: Array.isArray(bids.data.commitments) ? bids.data.commitments.length : 0,
        reveals: Array.isArray(bids.data.reveals) ? bids.data.reveals.length : 0,
        evidence: Array.isArray(packages.data) ? packages.data.length : 0,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [caseData.id, dataSource]);

  const missing = useMemo(
    () => (evidence?.checklist ?? []).filter((item) => !checklist[item.label]),
    [checklist, evidence],
  );
  const canDecide = caseData.status === 'COMPLETION_SUBMITTED' && Boolean(evidence) && !decision;
  const readyToDecide = canDecide && confirmRole && confirmReviewed && confirmHuman;
  const separationOk = caseData.contractorId !== caseData.inspectorId;

  async function recordLiveDecision(nextDecision: Decision) {
    if (!evidence) return;
    setSubmitting(true);
    setActionStatus(null);
    setActionTxHash(null);
    const stored = storeDemoIdentity({ role: 'INSPECTOR', account: inspectorAccount });
    if (!stored) {
      setActionStatus(
        'The INSPECTOR demo role could not be stored in this browser. No API request was sent and no inspection was recorded.',
      );
      setSubmitting(false);
      return;
    }

    try {
      const notesHash = await sha256Hex(notes);
      const inspection = await createInspection(caseData.id, {
        kind: 'COMPLETION',
        decision: nextDecision,
        evidencePackageId: evidence.id,
        ...(notesHash ? { notesHash } : {}),
      });

      if (!inspection.ok) {
        setActionStatus(`The API did not record the inspection: ${inspection.message}`);
        return;
      }

      if (!inspection.data?.id) {
        setActionStatus(
          'The API accepted the inspection but returned no inspection id, so no completion acceptance was sent.',
        );
        return;
      }

      setDecision(nextDecision);

      if (nextDecision === 'REJECTED') {
        setActionStatus(
          'The API recorded a REJECTED completion inspection. The work order state was not changed; a human dispute/resolution path is still required.',
        );
        router.refresh();
        return;
      }

      const action = await postWorkOrderAction(caseData.id, 'accept_completion', {
        inspectionId: inspection.data.id,
      });
      const summary = summarizeActionResult(action, 'completion acceptance');
      setActionStatus(summary.message);
      setActionTxHash(summary.realTransaction && summary.txHash ? summary.txHash : null);
      if (summary.applied && summary.realTransaction) router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  function recordReplayDecision(nextDecision: Decision) {
    setDecision(nextDecision);
    setActionStatus(
      `Replay decision recorded: ${nextDecision === 'APPROVED' ? 'accept completion' : 'reject completion'}. No wallet signature, transaction hash or live contract state was produced.`,
    );
  }

  function decide(nextDecision: Decision) {
    if (liveData) {
      void recordLiveDecision(nextDecision);
      return;
    }
    recordReplayDecision(nextDecision);
  }

  const suggestions = [
    ...missing.map((item) => ({
      title: `Checklist item incomplete: ${item.label}`,
      detail: item.note ?? 'Request a redacted photo or a short note from the contractor. Do not infer physical quality from a missing item.',
      tone: 'missing' as const,
    })),
    {
      title: 'Optional: second angle of the repaired fixing',
      detail: 'A second angle can make the redacted evidence easier to review. This is a completeness suggestion, not a quality judgement.',
      tone: 'advisory' as const,
    },
    {
      title: 'Human-only: physical condition',
      detail: 'The assistant cannot certify that the repair is safe, durable or complete. That decision belongs to the rostered human inspector.',
      tone: 'human' as const,
    },
  ];

  return (
    <div className="container">
      <PageHero
        eyebrow="Inspector console"
        title="Evidence review, human decision."
        lead="AI can identify missing checklist items. It cannot accept the work, sign an inspection or certify physical quality. Those controls belong to a rostered human inspector who is not the contractor."
        aside={
          <div className="side-card">
            <h2>Assignment</h2>
            <p className="side-card__value" style={{ fontSize: '1.15rem', fontFamily: 'var(--font-mono)' }}>
              {caseData.id}
            </p>
            <p className="side-card__note">{caseData.title}</p>
            <div style={{ marginTop: 8 }}>
              <Badge tone={caseSourceTone(dataSource, caseData.mode)}>{sourceLabel}</Badge>
            </div>
            <dl>
              <div>
                <dt>Inspector</dt>
                <dd className="mono">{shortAccount(caseData.inspectorId ?? 'Not assigned')}</dd>
              </div>
              <div>
                <dt>Contractor</dt>
                <dd className="mono">{shortAccount(caseData.contractorId ?? 'Not awarded')}</dd>
              </div>
              <div>
                <dt>Held in escrow</dt>
                <dd>{usdc(caseData.escrow.escrowedMicro ?? '0')}</dd>
              </div>
              <div>
                <dt>Bid commitments</dt>
                <dd>{liveCounts ? liveCounts.commitments : caseData.commitments.length}</dd>
              </div>
              <div>
                <dt>Bid reveals</dt>
                <dd>{liveCounts ? liveCounts.reveals : caseData.reveals.length}</dd>
              </div>
              <div>
                <dt>Evidence packages</dt>
                <dd>{liveCounts ? liveCounts.evidence : caseData.evidence.length}</dd>
              </div>
              <div>
                <dt>Decision</dt>
                <dd>{decision ? decision.toLowerCase() : caseData.status === 'COMPLETION_SUBMITTED' ? 'Pending' : 'No pending review'}</dd>
              </div>
            </dl>
            <div className="rule-note">
              {separationOk
                ? 'Separation of duties holds: the inspector and contractor are different accounts.'
                : 'Separation of duties failed: the inspector must not be the contractor.'}
            </div>
          </div>
        }
      />

      {dataSource === 'api' ? (
        <p className="source-note source-note--live" style={{ marginBottom: 14 }}>
          <ShieldCheck size={16} aria-hidden="true" />
          <span>
            <strong>Live API record.</strong>{' '}
            {liveCounts
              ? `Read-only bids and evidence endpoints returned ${liveCounts.commitments} commitments, ${liveCounts.reveals} reveals and ${liveCounts.evidence} evidence package${liveCounts.evidence === 1 ? '' : 's'}.`
              : liveCountsError ?? 'Loading the live bids and evidence endpoints…'}
          </span>
        </p>
      ) : null}

      <div className="form-shell" style={{ paddingTop: 0 }}>
        <div className="form-main">
          <section className="panel" aria-labelledby="evidence-review-title">
            <div className="panel__head">
              <div>
                <p className="eyebrow">Evidence package</p>
                <h2 id="evidence-review-title">
                  {evidence ? `${evidence.id} · ${evidence.kind.toLowerCase()}` : 'No evidence package'}
                </h2>
                <p>
                  {evidence
                    ? `${evidence.submittedBy} · submitted ${formatDateTime(evidence.submittedAt)} · redacted only`
                    : 'Nothing has been submitted for review.'}
                </p>
              </div>
              <Badge tone="positive">
                <Lock size={14} aria-hidden="true" /> Redacted
              </Badge>
            </div>

            {evidence ? (
              <>
                <div className="evidence-grid" aria-label="Redacted evidence previews">
                  {evidence.evidenceHashes.map((hash, index) => (
                    <div key={hash} className="evidence-tile">
                      <div className="evidence-tile__art">
                        <ImageIcon size={24} />
                        <span className="evidence-tile__redact" />
                      </div>
                      <div className="evidence-tile__copy">
                        <span>Evidence {index + 1}</span>
                        <code title={hash}>{hash.slice(0, 14)}…</code>
                      </div>
                      <p>Private preview withheld from public view.</p>
                    </div>
                  ))}
                </div>
                <p className="source-note source-note--replay" style={{ marginTop: 12 }}>
                  <Lock size={16} aria-hidden="true" />
                  <span>
                    {dataSource === 'api'
                      ? 'The live API supplies redacted hashes only. This console never receives raw media or a private evidence URL.'
                      : 'This public replay deliberately does not render private evidence URLs or raw media. A live inspector view would use short-lived, role-scoped access and the same redacted hashes.'}
                  </span>
                </p>

                <h3 style={{ marginTop: 20, fontSize: '1rem' }}>Checklist (reviewed locally)</h3>
                <ul className="checklist">
                  {evidence.checklist.map((item, index) => (
                    <li key={item.label} className="checklist__item">
                      <input
                        id={`check-${item.label.replace(/\s+/g, '-').toLowerCase()}`}
                        data-testid={`inspector-checklist-${index}`}
                        type="checkbox"
                        checked={Boolean(checklist[item.label])}
                        onChange={(event) =>
                          setChecklist((current) => ({ ...current, [item.label]: event.target.checked }))
                        }
                      />
                      <label htmlFor={`check-${item.label.replace(/\s+/g, '-').toLowerCase()}`}>
                        {item.label}
                        {item.note ? <small>{item.note}</small> : null}
                      </label>
                    </li>
                  ))}
                </ul>

                <div className="hash-stack" style={{ marginTop: 14 }}>
                  {evidence.evidenceHashes.map((hash, index) => (
                    <HashDisplay key={hash} value={hash} label={`Evidence hash ${index + 1}`} />
                  ))}
                </div>
              </>
            ) : (
              <p className="empty-state">No completion evidence has been submitted for this work order.</p>
            )}
          </section>

          <section className="panel" aria-labelledby="ai-suggestions-title">
            <div className="panel__head">
              <div>
                <p className="eyebrow">Completeness assistant</p>
                <h2 id="ai-suggestions-title">Suggestions, never a decision</h2>
                <p>
                  The reviewer agent compares redacted evidence with the approved checklist. It returns missing items; it
                  does not certify physical quality.
                </p>
              </div>
              <Badge tone="warning">
                <Sparkles size={14} aria-hidden="true" /> AI advisory
              </Badge>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.title}
                  className={`suggestion${suggestion.tone === 'human' ? ' suggestion--human' : ''}`}
                >
                  {suggestion.tone === 'human' ? <Users size={17} /> : <Sparkles size={17} />}
                  <div>
                    <strong>{suggestion.title}</strong>
                    {suggestion.detail}
                  </div>
                </div>
              ))}
            </div>
            <Callout tone="warning" title="No acceptance authority">
              There is no “AI approve” control. The reviewer assistant cannot click, sign or imply final acceptance. Its
              output is a proposal for a human to read.
            </Callout>
          </section>

          <section className="human-panel" aria-labelledby="human-decision-title">
            <div className="human-panel__head">
              <div>
                <p className="eyebrow">Human-only control</p>
                <h2 id="human-decision-title">Record the inspector decision</h2>
              </div>
              <Badge tone={readyToDecide ? 'positive' : 'neutral'}>
                <Users size={14} aria-hidden="true" /> {caseData.inspectorId ? shortAccount(caseData.inspectorId) : 'No inspector'}
              </Badge>
            </div>

            {!canDecide ? (
              <Callout tone="warning" title={decision ? 'Decision already recorded' : 'No valid pending decision'}>
                {decision
                  ? liveData
                    ? 'An inspection decision was recorded through the API. The case is not shown as advanced unless the API reported the corresponding action.'
                    : 'A replay decision was recorded below. No wallet signature or transaction was produced.'
                  : caseData.status === 'CLOSED'
                    ? 'This work order is closed. Its human decisions are recorded in the timeline and cannot be replayed again.'
                    : `The work order is in ${caseData.status}, which does not accept a completion decision. The controls are disabled rather than pretending the transition is valid.`}
              </Callout>
            ) : null}

            <fieldset className="checklist" style={{ border: 0, padding: 0, marginTop: 14 }}>
              <legend className="label">Confirm before you decide</legend>
              <ul className="checklist" style={{ marginTop: 8 }}>
                <li className="checklist__item">
                  <input
                    id="confirm-role"
                    data-testid="inspector-confirm-role"
                    type="checkbox"
                    checked={confirmRole}
                    onChange={(e) => setConfirmRole(e.target.checked)}
                    disabled={!canDecide}
                  />
                  <label htmlFor="confirm-role">
                    I am the rostered inspector for this work order and I am not the contractor.
                  </label>
                </li>
                <li className="checklist__item">
                  <input
                    id="confirm-reviewed"
                    data-testid="inspector-confirm-reviewed"
                    type="checkbox"
                    checked={confirmReviewed}
                    onChange={(e) => setConfirmReviewed(e.target.checked)}
                    disabled={!canDecide}
                  />
                  <label htmlFor="confirm-reviewed">
                    I reviewed every redacted evidence item myself, including missing checklist items.
                  </label>
                </li>
                <li className="checklist__item">
                  <input
                    id="confirm-human"
                    data-testid="inspector-confirm-human"
                    type="checkbox"
                    checked={confirmHuman}
                    onChange={(e) => setConfirmHuman(e.target.checked)}
                    disabled={!canDecide}
                  />
                  <label htmlFor="confirm-human">
                    I understand the AI suggestions are advisory and cannot make this acceptance decision.
                  </label>
                </li>
              </ul>
            </fieldset>

            <div className="field">
              <label htmlFor="inspection-notes">Inspector notes (optional)</label>
              <textarea
                id="inspection-notes"
                className="textarea"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="What did you check? What remains missing? Do not include private media URLs or personal data."
                disabled={!canDecide}
              />
              <span className="field__hint">
                {liveData
                  ? 'Notes are hashed in the browser and only the hash is sent to the API. Raw notes are not persisted here.'
                  : 'Notes are hashed in the live flow. This public replay does not store or transmit them.'}
              </span>
            </div>

            <div className="decision-actions">
              <button
                type="button"
                className="button"
                data-testid="inspector-accept"
                disabled={submitting || !readyToDecide}
                onClick={() => decide('APPROVED')}
              >
                <Check size={16} aria-hidden="true" />{' '}
                {submitting ? 'Sending…' : liveData ? 'Accept completion on testnet' : 'Accept completion'}
              </button>
              <button
                type="button"
                className="button button--danger"
                data-testid="inspector-reject"
                disabled={submitting || !readyToDecide}
                onClick={() => decide('REJECTED')}
              >
                <X size={16} aria-hidden="true" />{' '}
                {liveData ? 'Record rejection inspection' : 'Reject completion'}
              </button>
              <Link className="button button--ghost" href={`/cases/${caseData.id}`}>
                Full case <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>

            {!readyToDecide && canDecide ? (
              <p className="field__hint" style={{ marginTop: 8 }} role="status">
                All three human confirmations are required before either decision becomes available.
              </p>
            ) : null}

            {actionStatus ? (
              <div className="signed-note" role="status">
                <strong>Inspector decision status.</strong> {actionStatus}
                {actionTxHash ? <TxHashRow hash={actionTxHash} label="Acceptance transaction" compact /> : null}
              </div>
            ) : decision ? (
              <div className="signed-note" role="status">
                <strong>
                  {liveData ? 'Inspection decision' : 'Replay decision'} recorded:{' '}
                  {decision === 'APPROVED' ? 'accept completion' : 'reject completion'}.
                </strong>{' '}
                {liveData
                  ? 'Only the API response determines whether the work order advanced. The interface does not supply a chain result.'
                  : 'No wallet signature, transaction hash or live contract state was produced. In live testnet, this action would require a real transaction and would not be shown as executed until the hash existed.'}
                {notes ? <span style={{ display: 'block', marginTop: 6 }}>Notes length: {notes.length} characters (not persisted).</span> : null}
              </div>
            ) : null}
          </section>

          <DataSourceNote
            source={dataSource}
            detail={fallbackReason}
            liveDetail={`Inspector console for ${caseData.id}. Case, bid and evidence data are read from the configured MEND API. Inspection and acceptance actions are enabled only after the global mode banner verifies LIVE_TESTNET, and use the INSPECTOR demo header path rather than a wallet signature.`}
          />
        </div>

        <aside className="form-aside" aria-label="Evidence and authority notes">
          <section className="side-card">
            <h2>Authority boundary</h2>
            <ul className="decision-list" style={{ marginTop: 10 }}>
              <li>
                <Check size={15} aria-hidden="true" /> Human inspector may accept or reject.
              </li>
              <li>
                <X size={15} aria-hidden="true" /> Reviewer AI may only flag missing items.
              </li>
              <li>
                <X size={15} aria-hidden="true" /> Contractor cannot inspect their own work.
              </li>
              <li>
                <X size={15} aria-hidden="true" /> AI cannot release escrow.
              </li>
            </ul>
          </section>
          <section className="side-card">
            <h2>Evidence rules</h2>
            <ul className="decision-list" style={{ marginTop: 10 }}>
              <li>
                <ShieldCheck size={15} aria-hidden="true" /> Only redacted hashes are public.
              </li>
              <li>
                <Lock size={15} aria-hidden="true" /> Private media stays off-chain.
              </li>
              <li>
                <Eye size={15} aria-hidden="true" /> Physical quality is a human observation.
              </li>
              <li>
                <FileText size={15} aria-hidden="true" /> Missing evidence is not a quality verdict.
              </li>
            </ul>
          </section>
          <section className="side-card">
            <h2>Recorded inspections</h2>
            {caseData.inspections.length === 0 ? (
              <p className="side-card__note">No inspection has been recorded for this work order yet.</p>
            ) : (
              <ul className="decision-list" style={{ marginTop: 10 }}>
                {caseData.inspections.map((inspection) => (
                  <li key={inspection.id}>
                    {inspection.decision === 'APPROVED' ? <Check size={15} /> : <AlertTriangle size={15} />}
                    <span>
                      {inspection.kind.toLowerCase()} · {inspection.decision.toLowerCase()}
                      <em>
                        {shortAccount(inspection.inspectorId)} · {formatDateTime(inspection.signedAt)}
                      </em>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
