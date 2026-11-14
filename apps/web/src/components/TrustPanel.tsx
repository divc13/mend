import type { CaseBundle } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { Badge, EvidenceTag, HashDisplay } from './ui';
import { AlertTriangle, Check, ExternalLink, ShieldCheck, Sparkles, Users, Eye } from './Icons';

function ExplorerLink({
  href,
  hash,
  label,
  source,
}: {
  href?: string;
  hash?: string;
  label: string;
  source: 'fixture' | 'api';
}) {
  if (!href || !hash) {
    return (
      <span className="explorer-missing">
        <AlertTriangle size={14} aria-hidden="true" />
        {source === 'api'
          ? 'No explorer link — the API did not return a real transaction hash for this reference.'
          : 'No explorer link — no real transaction hash in this replay fixture.'}
      </span>
    );
  }
  return (
    <a className="text-link" href={href} target="_blank" rel="noreferrer noopener">
      {label} <ExternalLink size={14} aria-hidden="true" />
    </a>
  );
}

export function TrustPanel({
  caseData,
  source = 'fixture',
}: {
  caseData: CaseBundle;
  source?: 'fixture' | 'api';
}) {
  const ai = caseData.attestations.find((item) => item.kind === 'NEAR_AI');
  const outlayer = caseData.attestations.find((item) => item.kind === 'OUTLAYER');
  const dao = caseData.attestations.find((item) => item.kind === 'DAO');
  const human = caseData.attestations.find((item) => item.kind === 'HUMAN');
  const physicalClaims = caseData.events.flatMap((event) =>
    (event.evidence ?? [])
      .filter((evidence) => evidence.kind === 'PHYSICAL')
      .map((evidence) => ({ at: event.at, title: event.title, value: evidence.value })),
  );

  return (
    <section className="trust-panel" aria-labelledby="trust-panel-title">
      <div className="trust-panel__head">
        <div>
          <p className="eyebrow">Verification ledger</p>
          <h2 id="trust-panel-title">What is verified, what is unavailable, and what is a human claim</h2>
        </div>
        <Badge tone={caseData.mode === 'REPLAY' ? 'warning' : 'positive'} icon={<AlertTriangle size={14} />}>
          {caseData.mode === 'REPLAY' ? 'REPLAY RECORDING' : 'LIVE TESTNET'}
        </Badge>
      </div>

      <div className="evidence-legend" role="list" aria-label="Evidence categories">
        <div role="listitem">
          <EvidenceTag kind="VERIFIED" />
          <p>Cryptographically checked inference, execution or transaction evidence.</p>
        </div>
        <div role="listitem">
          <EvidenceTag kind="UNAVAILABLE" />
          <p>Expected evidence that was not available, not bundled or not verified. Never shown as verified.</p>
        </div>
        <div role="listitem">
          <EvidenceTag kind="HUMAN" />
          <p>A named human decision. A human signed or explicitly confirmed it; AI did not.</p>
        </div>
        <div role="listitem">
          <EvidenceTag kind="PHYSICAL" />
          <p>A claim about the physical world. It is not machine-certified and does not imply structural safety.</p>
        </div>
      </div>

      <div className="trust-grid">
        <article className="trust-item">
          <div className="trust-item__head">
            <span className="trust-icon">
              <Sparkles size={18} />
            </span>
            <div>
              <h3>Private AI triage</h3>
              <p className="trust-item__sub">NEAR AI Cloud · structured output only</p>
            </div>
            <EvidenceTag kind={ai?.verified ? 'VERIFIED' : 'UNAVAILABLE'} />
          </div>
          <p>{ai?.detail ?? 'No AI triage artifact is attached to this work order.'}</p>
          {ai?.unavailableReason ? (
            <p className="unavailable-reason">
              <AlertTriangle size={14} aria-hidden="true" /> {ai.unavailableReason}
            </p>
          ) : ai?.signature ? (
            <HashDisplay value={ai.signature} label="Response signature" />
          ) : null}
          <p className="trust-footnote">
            AI proposes classification, duplicate candidates and scope. It cannot approve scope, award a bid or move
            money.
          </p>
        </article>

        <article className="trust-item">
          <div className="trust-item__head">
            <span className="trust-icon">
              <ShieldCheck size={18} />
            </span>
            <div>
              <h3>OutLayer deterministic execution</h3>
              <p className="trust-item__sub">Hash-pinned WASM · no LLM ranking</p>
            </div>
            <EvidenceTag kind={outlayer?.verified ? 'VERIFIED' : 'UNAVAILABLE'} />
          </div>
          <p>{outlayer?.detail ?? 'No scoring execution is attached to this work order.'}</p>
          <div className="hash-stack">
            {caseData.score ? (
              <>
                <HashDisplay value={caseData.score.policyHash} label="Policy hash" />
                <HashDisplay value={caseData.score.wasmHash} label="WASM hash" />
                <HashDisplay value={caseData.score.inputHash} label="Input hash" />
                <HashDisplay value={caseData.score.outputHash} label="Output hash" />
              </>
            ) : (
              <p className="muted">Scoring has not run. No execution hashes exist yet.</p>
            )}
          </div>
          {outlayer?.unavailableReason ? (
            <p className="unavailable-reason">
              <AlertTriangle size={14} aria-hidden="true" /> {outlayer.unavailableReason}
            </p>
          ) : null}
          <p className="trust-footnote">
            A live result would be accepted only through the configured OutLayer callback and matching policy, WASM,
            input and output hashes.
          </p>
        </article>

        <article className="trust-item">
          <div className="trust-item__head">
            <span className="trust-icon">
              <Users size={18} />
            </span>
            <div>
              <h3>Human decisions</h3>
              <p className="trust-item__sub">Steward · inspector · DAO</p>
            </div>
            <EvidenceTag kind="HUMAN" />
          </div>
          <ul className="decision-list">
            {caseData.cluster ? (
              <li>
                <Check size={15} aria-hidden="true" />
                <span>
                  <strong>{caseData.cluster.confirmedBy}</strong> confirmed duplicate cluster {caseData.cluster.id}
                  <em>{formatDateTime(caseData.cluster.createdAt)}</em>
                </span>
              </li>
            ) : null}
            {caseData.inspections.map((inspection) => (
              <li key={inspection.id}>
                {inspection.decision === 'APPROVED' ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <AlertTriangle size={15} aria-hidden="true" />
                )}
                <span>
                  <strong>{inspection.inspectorId}</strong> {inspection.decision.toLowerCase()} {inspection.kind.toLowerCase()} inspection
                  <em>{formatDateTime(inspection.signedAt)}</em>
                </span>
              </li>
            ))}
            {caseData.daoApproval.state === 'APPROVED' ? (
              <li>
                <Check size={15} aria-hidden="true" />
                <span>
                  <strong>{caseData.daoApproval.daoAccount}</strong> approved proposal #{caseData.daoApproval.proposalId}
                  <em>{caseData.daoApproval.approvedAt ? formatDateTime(caseData.daoApproval.approvedAt) : 'time unavailable'}</em>
                </span>
              </li>
            ) : null}
          </ul>
          {human?.unavailableReason ? (
            <p className="unavailable-reason">
              <AlertTriangle size={14} aria-hidden="true" /> {human.unavailableReason}
            </p>
          ) : null}
          <p className="trust-footnote">
            {source === 'api'
              ? 'A named decision is not the same as a cryptographic signature. The API labels human actors but no wallet signature is inferred.'
              : 'A named decision is not the same as a cryptographic signature. Replay fixtures label human actors but do not bundle their wallet signatures.'}
          </p>
        </article>

        <article className="trust-item">
          <div className="trust-item__head">
            <span className="trust-icon">
              <Eye size={18} />
            </span>
            <div>
              <h3>Physical-world claims</h3>
              <p className="trust-item__sub">Contractor evidence · inspector observation</p>
            </div>
            <EvidenceTag kind="PHYSICAL" />
          </div>
          {physicalClaims.length > 0 ? (
            <ul className="decision-list">
              {physicalClaims.map((claim, index) => (
                <li key={`${claim.at}-${index}`}>
                  <Eye size={15} aria-hidden="true" />
                  <span>
                    {claim.value ?? claim.title}
                    <em>{formatDateTime(claim.at)} · observed claim, not machine-certified</em>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              No physical observation is recorded yet. Completion evidence is a contractor claim until a human inspector
              reviews it.
            </p>
          )}
          <p className="trust-footnote">
            MEND does not certify structural, electrical or gas safety. Physical claims remain the responsibility of the
            named contractor and human inspector.
          </p>
        </article>
      </div>

      <div className="trust-panel__footer">
        <div>
          <h3>Transaction links</h3>
          {caseData.fundingTxHash ? (
            <ExplorerLink
              href={caseData.attestations.find((item) => item.explorerUrl)?.explorerUrl}
              hash={caseData.fundingTxHash}
              label="Funding transaction"
              source={source}
            />
          ) : (
            <ExplorerLink label="Funding transaction" source={source} />
          )}
        </div>
        <div>
          <h3>Contract references</h3>
          <dl className="inline-facts">
            <div>
              <dt>Hub</dt>
              <dd className="mono">{NEXT_HUB}</dd>
            </div>
            <div>
              <dt>Token</dt>
              <dd className="mono">{caseData.fundingToken}</dd>
            </div>
            <div>
              <dt>DAO</dt>
              <dd className="mono">{caseData.daoApproval.daoAccount}</dd>
            </div>
          </dl>
        </div>
        <div>
          <h3>Why hashes matter</h3>
          <p className="trust-footnote">
            Hashes bind the displayed evidence to bytes without publishing private media. The hash alone does not prove a
            physical repair. It proves that the referenced bytes were the bytes evaluated or recorded.
          </p>
        </div>
      </div>
    </section>
  );
}

const NEXT_HUB = 'mend-hub-v2.testnet';
