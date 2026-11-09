import type { Metadata } from 'next';
import Link from 'next/link';
import { FIXTURE_VERSION, HASHES } from '@/lib/fixtures';
import { Badge, EvidenceTag, HashDisplay, PageHero, SectionHead } from '@/components/ui';
import { DataSourceNote } from '@/components/DataSourceNote';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ExternalLink,
  Eye,
  FileText,
  Lock,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from '@/components/Icons';

export const metadata: Metadata = {
  title: 'Privacy, trust & limitations',
  description:
    'MEND trust model: verified inference evidence, unavailable evidence, human decisions and physical claims. Privacy, OutLayer hashes, explorer-link rules and honest limitations.',
};

export default function TrustPage() {
  return (
    <>
      <div className="container">
        <PageHero
          eyebrow="Privacy & trust"
          title="The interface must not lie for the system."
          lead="MEND separates cryptographic evidence, unavailable evidence, human decisions and physical-world claims. A repair can be approved by a person without pretending that a model or a hash inspected the bench."
          aside={
            <div className="side-card">
              <h2>Environment</h2>
              <p className="side-card__value" style={{ fontSize: '1.2rem' }}>
                {FIXTURE_VERSION}
              </p>
              <p className="side-card__note">
                This build is a replay recording. No live AI attestation, OutLayer callback, testnet transaction or physical
                verification is claimed.
              </p>
              <div style={{ marginTop: 12 }}>
                <Badge tone="warning">REPLAY / SIMULATION</Badge>
              </div>
            </div>
          }
        />
      </div>

      <section className="section section--tight" aria-labelledby="taxonomy-title">
        <div className="container">
          <SectionHead
            id="taxonomy-title"
            eyebrow="Evidence taxonomy"
            title="Four different things, four different labels"
            lead="The same green tick must never mean all four. The trust panel applies these categories everywhere."
          />
          <div className="trust-page-grid">
            <article className="trust-page-card">
              <EvidenceTag kind="VERIFIED" />
              <h2 style={{ marginTop: 12 }}>Verified inference evidence</h2>
              <p>
                A cryptographic check passed for the exact request and response bytes: a NEAR AI attestation, an OutLayer
                execution hash, a DAO proposal reference or a real transaction.
              </p>
              <ul>
                <li>Signature or attestation verified against the expected service.</li>
                <li>Hash binding matches the policy, input and output.</li>
                <li>Explorer link exists only for a real transaction hash.</li>
              </ul>
            </article>
            <article className="trust-page-card">
              <EvidenceTag kind="UNAVAILABLE" />
              <h2 style={{ marginTop: 12 }}>Unavailable evidence</h2>
              <p>
                Evidence that would strengthen the case but is not available, not bundled or not verifiable. It is shown
                with a reason, never with a success tick.
              </p>
              <ul>
                <li>Replay recordings may not include live AI signatures.</li>
                <li>OutLayer may be unavailable; a local hash-pinned result must say so.</li>
                <li>No explorer link is invented to fill the gap.</li>
              </ul>
            </article>
            <article className="trust-page-card">
              <EvidenceTag kind="HUMAN" />
              <h2 style={{ marginTop: 12 }}>Human decision</h2>
              <p>
                A named steward or rostered inspector made a decision. AI cannot award, accept, refund or release escrow.
                A human decision is not automatically a cryptographic signature.
              </p>
              <ul>
                <li>Steward confirms duplicate merge, scope and award.</li>
                <li>Inspector accepts completion and durability.</li>
                <li>DAO resolves disputes; the contract still checks the role.</li>
              </ul>
            </article>
            <article className="trust-page-card">
              <EvidenceTag kind="PHYSICAL" />
              <h2 style={{ marginTop: 12 }}>Physical claim</h2>
              <p>
                A statement about the real world: the seat is stable, the hinge latches, the site is clean. It is not
                machine-certified and does not imply structural, electrical or gas safety.
              </p>
              <ul>
                <li>Contractor evidence is a claim until a human reviews it.</li>
                <li>Inspection notes record what a person observed.</li>
                <li>MEND does not dispatch emergency services.</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="section section--paper" aria-labelledby="outlayer-title">
        <div className="container">
          <SectionHead
            id="outlayer-title"
            eyebrow="Deterministic execution"
            title="Hash-bound ranking, never an LLM verdict"
            lead="The bid winner is computed by a versioned WASM policy through OutLayer. The steward confirms the rank-1 eligible bid; the model does not choose."
          />
          <div className="dashboard-grid">
            <article className="trust-page-card">
              <h2>Execution hashes</h2>
              <p>
                These are the canonical fixture hashes for policy, WASM, input and output. They are reproducible from the
                frozen revealed bids, but this replay does not claim a live OutLayer callback.
              </p>
              <div className="hash-stack" style={{ marginTop: 14 }}>
                <HashDisplay value={HASHES.policy} label="Policy hash" />
                <HashDisplay value={HASHES.wasm} label="WASM hash" />
                <HashDisplay value={HASHES.input} label="Input hash" />
                <HashDisplay value={HASHES.output} label="Output hash" />
              </div>
              <div className="source-note source-note--replay" style={{ marginTop: 14 }}>
                <AlertTriangle size={16} aria-hidden="true" />
                <span>
                  <strong>Recorded execution, not a live callback.</strong> The hash binding is meaningful; the absence of a
                  live OutLayer execution reference is stated rather than hidden.
                </span>
              </div>
            </article>

            <article className="trust-page-card">
              <h2>Policy weights</h2>
              <p>
                Price 45% · warranty 25% · duration 20% · materials 10%. Integer normalisation and tie-breaks are specified
                in the published rules. Price alone never wins.
              </p>
              <div className="weights">
                <div className="weight">
                  <span>Price</span>
                  <strong>45%</strong>
                </div>
                <div className="weight">
                  <span>Warranty</span>
                  <strong>25%</strong>
                </div>
                <div className="weight">
                  <span>Duration</span>
                  <strong>20%</strong>
                </div>
                <div className="weight">
                  <span>Materials</span>
                  <strong>10%</strong>
                </div>
              </div>
              <div className="rule-note">
                A wrong policy hash, modified bid input or stale execution is rejected by the contract. Invalid, late or
                non-roster bids cannot win.
              </div>
              <Link className="text-link" href="/bids/WO-BENCH-001-0001" style={{ marginTop: 12 }}>
                Inspect the revealed comparison <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="privacy-title">
        <div className="container">
          <SectionHead
            id="privacy-title"
            eyebrow="Privacy model"
            title="Report without a wallet. Keep precision private."
            lead="The public experience is designed to be useful without exposing the reporter, the exact location or private evidence."
          />
          <div className="privacy-list">
            <div className="privacy-item">
              <h3>
                <Wallet size={17} aria-hidden="true" /> No wallet to report
              </h3>
              <p>
                A report needs no wallet, signature or payment. The private case link is the reporter's key to status; it is
                not posted publicly.
              </p>
            </div>
            <div className="privacy-item">
              <h3>
                <Lock size={17} aria-hidden="true" /> Client-side EXIF stripping
              </h3>
              <p>
                The browser re-encodes the photo before upload, dropping GPS, camera model and capture time. Manual
                redactions are burned into the outgoing preview.
              </p>
            </div>
            <div className="privacy-item">
              <h3>
                <Eye size={17} aria-hidden="true" /> Coarse public location
              </h3>
              <p>
                The map uses a schematic location and an approximate area. Precise coordinates are stored off-chain and
                shared only with authorized roles.
              </p>
            </div>
            <div className="privacy-item">
              <h3>
                <FileText size={17} aria-hidden="true" /> Hashes, not media, on-chain
              </h3>
              <p>
                Public contract state references redacted evidence hashes. Raw media and private evidence URLs never enter
                public state.
              </p>
            </div>
            <div className="privacy-item">
              <h3>
                <ShieldCheck size={17} aria-hidden="true" /> Role-scoped private access
              </h3>
              <p>
                Live inspectors would use short-lived, role-scoped evidence access. This replay deliberately does not
                render private evidence previews publicly.
              </p>
            </div>
            <div className="privacy-item">
              <h3>
                <Sparkles size={17} aria-hidden="true" /> No browser secrets
              </h3>
              <p>
                AI, Intents and storage credentials stay server-side. The browser receives quote objects and public data,
                never API keys, JWTs or signing material.
              </p>
            </div>
          </div>
          <Link className="button button--ghost" href="/report" style={{ marginTop: 20 }}>
            Try the walletless report flow <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="section section--paper" aria-labelledby="real-title">
        <div className="container">
          <SectionHead
            id="real-title"
            eyebrow="Honest disclosure"
            title="What is real in this build"
            lead="The UI is real software. The recording is not a live network event, and no physical verification is manufactured."
          />
          <div className="trust-page-grid">
            <article className="trust-page-card">
              <h2>
                <Check size={18} aria-hidden="true" /> Real in this build
              </h2>
              <ul>
                <li>The public pages, accessibility behaviour and responsive layout.</li>
                <li>Client-side EXIF stripping, manual redaction and SHA-256 of the redacted preview.</li>
                <li>Deterministic integer scoring reproduced from the frozen revealed bids.</li>
                <li>Ledger arithmetic and status explanations from the protocol fixtures.</li>
                <li>No wallet and no private evidence URL in public pages.</li>
              </ul>
            </article>
            <article className="trust-page-card">
              <h2>
                <AlertTriangle size={18} aria-hidden="true" /> Staged or unavailable
              </h2>
              <ul>
                <li>Physical repair photos and inspection observations are staged pilot material.</li>
                <li>NEAR AI response signatures are not bundled; those panels say unavailable.</li>
                <li>OutLayer execution is a reproducible replay, not a live callback.</li>
                <li>Intents quotes, fees and deposit instructions are dry previews; no mainnet funds move.</li>
                <li>Test USDC has no real value.</li>
              </ul>
            </article>
            <article className="trust-page-card">
              <h2>
                <X size={18} aria-hidden="true" /> Not claimed at all
              </h2>
              <ul>
                <li>City adoption, municipal partnership or emergency dispatch.</li>
                <li>Structural, electrical or gas safety certification.</li>
                <li>Legal ownership of a physical asset through the passport.</li>
                <li>A live transaction volume or real-funds performance.</li>
                <li>AI authority over scope, award, acceptance or payment.</li>
              </ul>
            </article>
            <article className="trust-page-card">
              <h2>
                <ExternalLink size={18} aria-hidden="true" /> Explorer-link rule
              </h2>
              <p>
                The UI only renders an explorer link when a real transaction hash exists. The replay fixtures contain no
                real funding, payment or Intents destination transaction hash, so the interface shows “no explorer link”
                instead.
              </p>
              <div className="callout callout--warning" style={{ marginTop: 12 }}>
                <div className="callout__icon">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <p className="callout__title">No fake links</p>
                  <div className="callout__body">
                    A labelled replay is honest only if every success claim is checked for the evidence that would make it
                    true.
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="limitations-title">
        <div className="container">
          <SectionHead
            id="limitations-title"
            eyebrow="Limitations"
            title="The edges of the system, stated plainly"
            lead="MEND is deliberately narrow. These are not hidden later items; they are boundaries of the pilot."
          />
          <div className="limitation-list">
            <div className="limitation">
              <strong>Low-risk assets only.</strong> The pilot does not begin with roads, live electricity, gas, structural
              work or anything requiring emergency dispatch.
            </div>
            <div className="limitation">
              <strong>AI is a proposal, not an oracle.</strong> Classification, duplicate candidates and completeness
              suggestions can be wrong. Human confirmation is required for merges, awards and acceptance.
            </div>
            <div className="limitation">
              <strong>Physical claims are not certification.</strong> A hash proves bytes, not that a repair is durable. A
              human inspection is still a human judgement.
            </div>
            <div className="limitation">
              <strong>Replay is not live.</strong> The deterministic scoring is reproducible from the recording, but the UI
              does not claim a live OutLayer callback, AI signature or testnet transaction.
            </div>
            <div className="limitation">
              <strong>Intents is mainnet-only.</strong> A real execution requires separate human approval and real funds.
              No agent or browser action in this demo can initiate it.
            </div>
            <div className="limitation">
              <strong>Disputes remain human.</strong> Funds can be frozen by a human dispute, but resolution requires an
              explicit DAO/human decision. AI cannot resolve it.
            </div>
          </div>

          <div className="closing-cta" style={{ marginTop: 28 }}>
            <div>
              <p className="eyebrow">Verify the story</p>
              <h2>Read a case from report to warranty.</h2>
              <p>Open the bench repair for a complete lifecycle, or the bicycle rack for a failed durability inspection.</p>
            </div>
            <div className="closing-cta__actions">
              <Link className="button button--light" href="/cases/WO-BENCH-001-0001">
                Successful repair <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link className="button button--ghost" href="/cases/WO-RACK-002-0001" style={{ color: 'var(--paper)', borderColor: 'rgba(245,241,230,.3)' }}>
                Warranty reopened
              </Link>
            </div>
          </div>

          <DataSourceNote detail={`${FIXTURE_VERSION}. Trust page statements describe the replay build; no live evidence is implied.`} />
        </div>
      </section>
    </>
  );
}
