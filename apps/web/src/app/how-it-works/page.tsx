import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Badge,
  Callout,
  EvidenceTag,
  HashDisplay,
  PageHero,
  SectionHead,
  type Tone,
} from '@/components/ui';
import { DataSourceNote } from '@/components/DataSourceNote';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Coins,
  ExternalLink,
  Eye,
  FileText,
  Gavel,
  Hammer,
  Info,
  Lock,
  Scale,
  ShieldCheck,
  Sparkles,
  Users,
} from '@/components/Icons';

export const metadata: Metadata = {
  title: 'How MEND works',
  description:
    'The complete MEND lifecycle and stack: report, private AI triage, steward scope, DAO authorization, sealed bids, deterministic scoring, repair, independent inspection, 72/8 settlement and a durability passport — with honest LIVE TESTNET, REPLAY / SIMULATION and UNAVAILABLE evidence labels.',
};

const GITHUB_DOCS = 'https://github.com/divc13/mend/blob/main';
const EXPLORER = 'https://explorer.testnet.near.org';

const DAO_AUTH_TX = '8LuSGzjxQ5W4xFb2eW4HZTocstHJgBby4uYhh5mdUJ6h';
const OUTLAYER_SETTLEMENT_TX = 'HHBDS4ymrGbUisX9NvfZJ6XTaC24aTShmomroX5XJYAQ';
const RELAYER_TX = 'Getpks826tszmEhMJBSEqT5z7kH9KsrCqQrZtBXxSSju';

type LifecycleStep = {
  number: string;
  title: string;
  actor: string;
  label: string;
  tone: Tone;
  icon: ReactNode;
  body: string;
  footnote: string;
};

const lifecycle: LifecycleStep[] = [
  {
    number: '01',
    title: 'Report',
    actor: 'Reporter · no wallet',
    label: 'NO WALLET',
    tone: 'positive',
    icon: <FileText size={17} aria-hidden="true" />,
    body:
      'A photo, a coarse location and one sentence. The browser re-encodes the image to strip EXIF/GPS and burns in manual redactions before upload. The reporter receives a private case link — no wallet, signature or payment.',
    footnote: 'Evidence: redacted preview hash and private case reference. Public pages never render precise coordinates.',
  },
  {
    number: '02',
    title: 'Private AI triage',
    actor: 'NEAR AI Cloud',
    label: 'AI PROPOSES · HUMAN DECIDES',
    tone: 'warning',
    icon: <Sparkles size={17} aria-hidden="true" />,
    body:
      'The model returns a classification, duplicate candidates, completeness checks and a draft scope with request/response hashes. It is a proposal, not an oracle. It cannot approve, award, accept, refund or release escrow.',
    footnote:
      'Live run: ATT-0001 has a valid signature, but no matching TEE report was retained. The artifact is UNAVAILABLE, not verified inference.',
  },
  {
    number: '03',
    title: 'Steward scope',
    actor: 'Named human steward',
    label: 'HUMAN DECISION',
    tone: 'info',
    icon: <Users size={17} aria-hidden="true" />,
    body:
      'A steward confirms duplicate merges, the repair scope, the evidence checklist and the maximum budget. The AI suggestion is advisory; the steward decision is human and recorded.',
    footnote: 'Evidence: human decision record and scope hash. A green interface badge is not a cryptographic proof.',
  },
  {
    number: '04',
    title: 'DAO authorization',
    actor: 'Sputnik DAO v2 council',
    label: 'LIVE TESTNET',
    tone: 'positive',
    icon: <Gavel size={17} aria-hidden="true" />,
    body:
      'The scope and budget are attached to a Sputnik DAO v2 proposal. The council votes; the approved proposal calls dao_authorize on the hub. This is a real testnet DAO, with no mainnet authority.',
    footnote:
      'Evidence: mend-dao.sputnikv2.testnet, proposal 1, authorization tx 8LuSGz…UJ6h. Test value only.',
  },
  {
    number: '05',
    title: 'Sealed bids',
    actor: 'Rostered contractors',
    label: 'COMMIT / REVEAL',
    tone: 'info',
    icon: <Lock size={17} aria-hidden="true" />,
    body:
      'Contractors commit a hash of their bid, then reveal price, duration, warranty, materials and availability after bidding closes. Commitments are checked against reveals. Late, invalid and non-roster bids cannot win.',
    footnote: 'Evidence: commit and reveal transactions on the hub. Prices stay sealed until close.',
  },
  {
    number: '06',
    title: 'Deterministic score',
    actor: 'Hash-pinned policy / OutLayer',
    label: 'DETERMINISTIC · NOT AN LLM VERDICT',
    tone: 'info',
    icon: <Scale size={17} aria-hidden="true" />,
    body:
      'A versioned Rust/WASM policy scores eligible bids with integer weights: price 45%, warranty 25%, duration 20%, materials 10%. The policy hash, input and output are bound. A steward confirms the rank-1 eligible bid; the model does not choose.',
    footnote:
      'Live OutLayer testnet: request 15579 succeeded. The hub V2 lifecycle score was still recorded as LOCAL_DETERMINISTIC, not a TEE-attested score.',
  },
  {
    number: '07',
    title: 'Repair',
    actor: 'Winning contractor',
    label: 'REPLAY / ILLUSTRATIVE',
    tone: 'warning',
    icon: <Hammer size={17} aria-hidden="true" />,
    body:
      'The winning contractor starts work. Completion evidence, receipts and notes are hashed onto the work order. A human inspector — not the contractor and not the AI — reviews the result.',
    footnote:
      'The pothole story is REPLAY / SIMULATION. Repair footage is illustrative stock footage, not a MEND field job.',
  },
  {
    number: '08',
    title: 'Independent inspection',
    actor: 'Independent human inspector',
    label: 'HUMAN DECISION',
    tone: 'info',
    icon: <Eye size={17} aria-hidden="true" />,
    body:
      'A rostered inspector checks completion evidence against the scope. Acceptance is a human decision. Rejection freezes payment and reopens the warranty on the same work order, so a failure cannot disappear into a new bounty.',
    footnote:
      'Evidence: inspector decision record and checklist. A human signature is not a structural, electrical or gas safety certificate.',
  },
  {
    number: '09',
    title: '72/8 settlement',
    actor: 'Hub escrow contract',
    label: 'LIVE TESTNET · EXACT SPLIT',
    tone: 'positive',
    icon: <Coins size={17} aria-hidden="true" />,
    body:
      'On acceptance, the hub releases 90% (72) to the contractor and retains 10% (8) as a durability holdback. A durability pass releases the holdback. The exact testnet split was 100 funded / 20 refunded at award / 72 completion / 8 holdback, with escrow 0.',
    footnote:
      'Evidence: the V2 testnet run recorded 42 transactions; all resolve, none has a failed receipt. A separate failed factory attempt is documented.',
  },
  {
    number: '10',
    title: 'Passport and durability',
    actor: 'Hub registry + inspector',
    label: 'NON-TRANSFERABLE',
    tone: 'neutral',
    icon: <ShieldCheck size={17} aria-hidden="true" />,
    body:
      'The asset passport records the repair, warranty and durability history. It is non-transferable and held by the hub registry; it is not a title deed or legal ownership record. A failed durability check reopens the same work order for remediation.',
    footnote: 'Evidence: passport token BENCH-V2-001 and durability inspection record.',
  },
];

type StackItem = {
  name: string;
  layer: string;
  label: string;
  tone: Tone;
  icon: ReactNode;
  body: string;
};

const stack: StackItem[] = [
  {
    name: 'Next.js 16 · React 19 · TypeScript',
    layer: 'Interface',
    label: 'APP LAYER',
    tone: 'neutral',
    icon: <FileText size={17} aria-hidden="true" />,
    body:
      'Public case experience, server-rendered pages, typed fixtures and accessible components. Evidence status is part of the interface, not a footnote.',
  },
  {
    name: 'Fastify',
    layer: 'API',
    label: 'API LAYER',
    tone: 'neutral',
    icon: <Info size={17} aria-hidden="true" />,
    body:
      'API boundary for reports, triage, deterministic scoring, quotes and wallet flows. Zod-validated request and response schemas; secrets stay server-side.',
  },
  {
    name: 'Postgres',
    layer: 'Persistence',
    label: 'DATA LAYER',
    tone: 'neutral',
    icon: <FileText size={17} aria-hidden="true" />,
    body:
      'Off-chain operational store for reports, private evidence metadata, audit events and job state. Public chain state references hashes, not raw media.',
  },
  {
    name: 'Rust / WASM contracts on NEAR',
    layer: 'Contracts',
    label: 'LIVE TESTNET',
    tone: 'positive',
    icon: <ShieldCheck size={17} aria-hidden="true" />,
    body:
      'Hub escrow, roles, work orders, sealed bids, passport and durability. The live testnet hub is mend-hub-v2.testnet.',
  },
  {
    name: 'Sputnik DAO v2',
    layer: 'Governance',
    label: 'LIVE TESTNET',
    tone: 'positive',
    icon: <Gavel size={17} aria-hidden="true" />,
    body:
      'Real testnet DAO at mend-dao.sputnikv2.testnet. Council proposal 1 authorized the final work order. No mainnet authority.',
  },
  {
    name: 'NEAR AI Cloud',
    layer: 'Private triage',
    label: 'UNAVAILABLE EVIDENCE',
    tone: 'warning',
    icon: <Sparkles size={17} aria-hidden="true" />,
    body:
      'Private triage proposals from z-ai/glm-5.3-flash. ATT-0001 has a valid signature but no retained TEE report; the UI labels it UNAVAILABLE.',
  },
  {
    name: 'OutLayer',
    layer: 'Deterministic compute',
    label: 'LIVE TESTNET',
    tone: 'positive',
    icon: <Scale size={17} aria-hidden="true" />,
    body:
      'Hash-pinned Rust/WASM execution for bid ranking. Live testnet request 15579 and a real settlement transaction; the full Intel DCAP signature chain is not verified.',
  },
  {
    name: '1Click Intents',
    layer: 'Liquidity',
    label: 'PENDING_DEPOSIT',
    tone: 'warning',
    icon: <Coins size={17} aria-hidden="true" />,
    body:
      'Signed same-chain USDT → USDC quote on NEAR mainnet. Status PENDING_DEPOSIT; no funds moved. A human must sign the deposit transactions.',
  },
  {
    name: 'Agent Market',
    layer: 'Agent labor',
    label: 'PAID SELF-HIRE',
    tone: 'info',
    icon: <Users size={17} aria-hidden="true" />,
    body:
      'Production listing mend-evidence-review. One disclosed paid self-hire was accepted; the payout ledger is NOT_COLLECTED, so no payout is claimed.',
  },
  {
    name: 'NEP-366 relayer',
    layer: 'Gasless UX',
    label: 'LIVE TESTNET',
    tone: 'positive',
    icon: <Lock size={17} aria-hidden="true" />,
    body:
      'Allowlisted gasless forwarding. A live delegate created WO-RELAYER-LIVE-0002; replay, wrong receiver, wrong method and expiry were rejected. No funding or payment methods.',
  },
];

const docs = [
  {
    title: 'Testnet V2 deployment',
    detail: 'Hub, Sputnik DAO, 42 transactions, exact 100 / 20 / 72 / 8 accounting.',
    path: 'infra/testnet-v2/LIVE-V2.md',
  },
  {
    title: 'Live NEAR AI run',
    detail: 'ATT-0001, signature checks and the missing TEE report.',
    path: 'scripts/near-ai-live/LIVE-NEAR-AI.md',
  },
  {
    title: 'Agent Market evidence',
    detail: 'Listing, disclosed paid self-hire and payout NOT_COLLECTED.',
    path: 'scripts/agent-market-live/LIVE-AGENT-MARKET.md',
  },
  {
    title: 'Intents evidence',
    detail: 'Signed quote, PENDING_DEPOSIT and the human signing blocker.',
    path: 'scripts/intents-live/LIVE-INTENTS.md',
  },
  {
    title: 'OutLayer evidence',
    detail: 'Request 15579, settlement transaction and the DCAP caveat.',
    path: 'infra/outlayer-live/LIVE-OUTLAY.md',
  },
  {
    title: 'NEP-366 relayer evidence',
    detail: 'Live delegate, four on-chain rejections and the no-funds boundary.',
    path: 'scripts/relayer-live/LIVE-RELAYER.md',
  },
];

function ExplorerLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="hiw-explorer" href={href} target="_blank" rel="noreferrer">
      {children} <ExternalLink size={13} aria-hidden="true" />
    </a>
  );
}

export default function HowItWorksPage() {
  return (
    <div data-testid="how-it-works">
      <div className="container">
        <PageHero
          eyebrow="Lifecycle & stack"
          title="How MEND works"
          lead="One report. One funded repair. One permanent record. MEND moves a report through private triage, human scope, DAO authorization, a sealed market and a deterministic score — then pays against independent inspection and keeps the history attached to the asset."
          aside={
            <div className="side-card">
              <h2>Evidence key</h2>
              <div className="hiw-key">
                <div className="hiw-key__item">
                  <Badge tone="positive">LIVE TESTNET</Badge>
                  <p>Real NEAR testnet state or transaction. Test mUSDC has no real value.</p>
                </div>
                <div className="hiw-key__item">
                  <Badge tone="warning">REPLAY / SIMULATION</Badge>
                  <p>Recorded or staged story. Not a live network event.</p>
                </div>
                <div className="hiw-key__item">
                  <Badge tone="warning">UNAVAILABLE</Badge>
                  <p>Missing or unverifiable evidence, shown with a reason and never promoted to verified.</p>
                </div>
              </div>
            </div>
          }
        >
          <div className="hiw-hero-actions">
            <Link className="button" href="/demo">
              Open the replay demo <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className="button button--ghost" href="/trust">
              Read the trust model
            </Link>
          </div>
        </PageHero>

        <div className="hero-stats hiw-stats" aria-label="Testnet proof at a glance">
          <div className="hero-stat">
            <strong>42</strong>
            <span>recorded testnet tx</span>
          </div>
          <div className="hero-stat">
            <strong>100 / 20 / 72 / 8</strong>
            <span>funded / refund / completion / holdback</span>
          </div>
          <div className="hero-stat">
            <strong>0</strong>
            <span>escrow remaining</span>
          </div>
        </div>
        <p className="source-note source-note--live hiw-strip-note">
          <Check size={16} aria-hidden="true" />
          <span>
            <strong>LIVE TESTNET.</strong> Work order WO-BENCH-V2-001-0002 is CLOSED. The V2 run recorded 42 testnet
            transactions; all resolve and none has a failed receipt. Test value only.
          </span>
        </p>
      </div>

      <section className="section" aria-labelledby="lifecycle-title">
        <div className="container">
          <SectionHead
            id="lifecycle-title"
            eyebrow="The lifecycle"
            title="Ten steps, with the decision and the evidence named"
            lead="Each step has an actor, a decision and a receipt. AI proposes; humans decide. The contract enforces roles and escrow arithmetic."
          />
          <ol className="hiw-lifecycle">
            {lifecycle.map((step) => (
              <li className="hiw-step" key={step.number}>
                <div className="hiw-step__top">
                  <span className="hiw-step__number">{step.number}</span>
                  <span className="hiw-step__icon">{step.icon}</span>
                </div>
                <div className="hiw-step__badges">
                  <Badge tone={step.tone}>{step.label}</Badge>
                  <span className="hiw-step__actor">{step.actor}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                <p className="hiw-step__foot">{step.footnote}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section--paper" aria-labelledby="stack-title">
        <div className="container">
          <SectionHead
            id="stack-title"
            eyebrow="The stack"
            title="A small stack with visible seams"
            lead="The public app, API and data store are ordinary software. The chain, DAO, compute, liquidity, agent and relayer pieces are named with their real evidence status."
          />
          <div className="hiw-stack-grid">
            {stack.map((item) => (
              <article className="hiw-stack-card" key={item.name}>
                <span className="hiw-stack-card__icon">{item.icon}</span>
                <div>
                  <div className="hiw-stack-card__head">
                    <div>
                      <p className="hiw-stack-card__layer">{item.layer}</p>
                      <h3>{item.name}</h3>
                    </div>
                    <Badge tone={item.tone}>{item.label}</Badge>
                  </div>
                  <p>{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="proof-title">
        <div className="container">
          <SectionHead
            id="proof-title"
            eyebrow="Real proof cards"
            title="The receipts, including the missing ones"
            lead="Every card names what exists. A real testnet transaction gets a real explorer link. A pending quote, an unavailable attestation and a replay story do not."
          />

          <div className="hiw-proof-grid">
            <article className="trust-page-card hiw-proof">
              <div className="hiw-proof__head">
                <div>
                  <p className="hiw-proof__id">mend-hub-v2.testnet</p>
                  <h3>Hub, DAO and the closed work order</h3>
                </div>
                <div className="hiw-proof__badges">
                  <Badge tone="positive">LIVE TESTNET</Badge>
                  <Badge tone="positive">42 TX VERIFIED</Badge>
                </div>
              </div>
              <p>
                A real Sputnik DAO v2 and a hub contract on NEAR testnet. The final work order is CLOSED; the exact escrow
                split is 100 funded / 20 refunded / 72 completion / 8 holdback, with 0 remaining.
              </p>
              <dl className="hiw-proof__facts">
                <div className="hiw-proof__fact">
                  <dt>Hub</dt>
                  <dd>
                    <a
                      className="hiw-explorer"
                      href={`${EXPLORER}/accounts/mend-hub-v2.testnet`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      mend-hub-v2.testnet <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  </dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>DAO</dt>
                  <dd>
                    <a
                      className="hiw-explorer"
                      href={`${EXPLORER}/accounts/mend-dao.sputnikv2.testnet`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      mend-dao.sputnikv2.testnet <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  </dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>Work order</dt>
                  <dd className="mono">
                    <Link className="hiw-explorer" href="/cases/WO-BENCH-V2-001-0002">
                      WO-BENCH-V2-001-0002 <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  </dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>Status</dt>
                  <dd>CLOSED · escrow 0</dd>
                </div>
              </dl>
              <div className="money-flow hiw-proof__money" aria-label="Exact testnet settlement split">
                <div className="money-step">
                  <p className="money-step__label">Funded</p>
                  <p className="money-step__value">100.00</p>
                  <p className="money-step__note">mUSDC into escrow</p>
                </div>
                <div className="money-step money-step--refund">
                  <p className="money-step__label">Refunded</p>
                  <p className="money-step__value">20.00</p>
                  <p className="money-step__note">at award</p>
                </div>
                <div className="money-step money-step--paid">
                  <p className="money-step__label">Completion</p>
                  <p className="money-step__value">72.00</p>
                  <p className="money-step__note">90% after acceptance</p>
                </div>
                <div className="money-step money-step--held">
                  <p className="money-step__label">Holdback</p>
                  <p className="money-step__value">8.00</p>
                  <p className="money-step__note">10% until durability</p>
                </div>
              </div>
              <div className="hiw-proof__links">
                <HashDisplay value={DAO_AUTH_TX} label="DAO authorization tx" />
                <ExplorerLink href={`${EXPLORER}/transactions/${DAO_AUTH_TX}`}>View authorization tx</ExplorerLink>
              </div>
              <p className="hiw-proof__note">
                A separate factory attempt failed with “Exceeded the prepaid gas”. It is recorded separately and is not
                counted in the 42 successful lifecycle transactions.
              </p>
            </article>

            <article className="trust-page-card hiw-proof">
              <div className="hiw-proof__head">
                <div>
                  <p className="hiw-proof__id">ATT-0001</p>
                  <h3>AI attestation: signature valid, TEE report unavailable</h3>
                </div>
                <div className="hiw-proof__badges">
                  <EvidenceTag kind="UNAVAILABLE" />
                  <Badge tone="positive">SIGNATURE VALID</Badge>
                </div>
              </div>
              <p>
                The live NEAR AI run returned a structured triage and a valid ECDSA signature over the exact request and
                response bytes. No matching TEE attestation report was retained, so the artifact is UNVERIFIED_INFERENCE —
                not verified inference evidence.
              </p>
              <dl className="hiw-proof__facts">
                <div className="hiw-proof__fact">
                  <dt>Provider</dt>
                  <dd>NEAR AI Cloud</dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>Model</dt>
                  <dd className="mono">z-ai/glm-5.3-flash</dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>Request / response hashes</dt>
                  <dd>match</dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>Signature</dt>
                  <dd>valid</dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>TEE report</dt>
                  <dd>unavailable</dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>Public label</dt>
                  <dd>UNAVAILABLE</dd>
                </div>
              </dl>
              <div className="hiw-proof__links">
                <Link className="text-link" href="/trust">
                  Evidence taxonomy <ArrowRight size={14} aria-hidden="true" />
                </Link>
                <ExplorerLink href={`${GITHUB_DOCS}/scripts/near-ai-live/LIVE-NEAR-AI.md`}>
                  Read the live AI record
                </ExplorerLink>
              </div>
              <p className="hiw-proof__note">
                The API fails closed: verified is false, and the UI never promotes this artifact to VERIFIED. No explorer
                link is shown because there is no on-chain transaction for ATT-0001.
              </p>
            </article>

            <article className="trust-page-card hiw-proof">
              <div className="hiw-proof__head">
                <div>
                  <p className="hiw-proof__id">request 15579</p>
                  <h3>OutLayer: deterministic execution on testnet</h3>
                </div>
                <div className="hiw-proof__badges">
                  <Badge tone="positive">LIVE TESTNET</Badge>
                  <Badge tone="warning">DCAP NOT VERIFIED</Badge>
                </div>
              </div>
              <p>
                MEND published a Rust/WASM bid-rules project to OutLayer testnet and executed it. The worker settled
                request 15579 with a real testnet transaction; the attestation binds the code, input and output hashes.
              </p>
              <dl className="hiw-proof__facts">
                <div className="hiw-proof__fact">
                  <dt>Project</dt>
                  <dd className="mono">mend-deployer.testnet/bid-rules</dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>WASM SHA-256</dt>
                  <dd className="mono">640589…1bf55</dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>Execution</dt>
                  <dd>success · 423,356 instructions · 382 ms</dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>Attestation</dt>
                  <dd>captured · full DCAP chain not verified</dd>
                </div>
              </dl>
              <div className="hiw-proof__links">
                <HashDisplay value={OUTLAYER_SETTLEMENT_TX} label="Worker settlement tx" />
                <ExplorerLink href={`${EXPLORER}/transactions/${OUTLAYER_SETTLEMENT_TX}`}>
                  View settlement tx
                </ExplorerLink>
              </div>
              <p className="hiw-proof__note">
                The hub V2 lifecycle score was recorded as LOCAL_DETERMINISTIC. The OutLayer run proves a real testnet
                publish/execute path; it is not a claim that every production score is TEE-attested.
              </p>
            </article>

            <article className="trust-page-card hiw-proof">
              <div className="hiw-proof__head">
                <div>
                  <p className="hiw-proof__id">mend-evidence-review</p>
                  <h3>Agent Market: live listing, disclosed self-hire</h3>
                </div>
                <div className="hiw-proof__badges">
                  <Badge tone="info">PAID SELF-HIRE</Badge>
                  <Badge tone="warning">PAYOUT NOT_COLLECTED</Badge>
                </div>
              </div>
              <p>
                The listing is live on the production Agent Market. A disclosed self-hire was paid 0.0100 USDC and the
                human buyer accepted the deliverable. The seller payout ledger row is NOT_COLLECTED, so no payout is
                claimed.
              </p>
              <dl className="hiw-proof__facts">
                <div className="hiw-proof__fact">
                  <dt>Listing</dt>
                  <dd>live · 1 delivered job · 100% success</dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>Escrow</dt>
                  <dd>0.0100 USDC</dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>Deliverable hash</dt>
                  <dd className="mono">6bd038…9a7e</dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>Final status</dt>
                  <dd>accepted · completed</dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>Payout</dt>
                  <dd>NOT_COLLECTED</dd>
                </div>
              </dl>
              <div className="hiw-proof__links">
                <ExplorerLink href="https://market.near.ai/a/mend-evidence-review">View the live listing</ExplorerLink>
                <ExplorerLink href={`${GITHUB_DOCS}/scripts/agent-market-live/LIVE-AGENT-MARKET.md`}>
                  Read the market record
                </ExplorerLink>
              </div>
              <p className="hiw-proof__note">
                The review is advisory only: it identifies missing evidence and does not certify safety, approve payment
                or claim a physical inspection.
              </p>
            </article>

            <article className="trust-page-card hiw-proof">
              <div className="hiw-proof__head">
                <div>
                  <p className="hiw-proof__id">1Click Intents · mainnet</p>
                  <h3>Signed quote, PENDING_DEPOSIT</h3>
                </div>
                <div className="hiw-proof__badges">
                  <Badge tone="warning">PENDING_DEPOSIT</Badge>
                  <Badge tone="neutral">NO FUNDS MOVED</Badge>
                </div>
              </div>
              <p>
                A signed same-chain USDT → USDC quote on NEAR mainnet is ready, but no deposit has been sent. The status is
                PENDING_DEPOSIT; the recipient also lacks USDC storage, and the human signer has not signed.
              </p>
              <dl className="hiw-proof__facts">
                <div className="hiw-proof__fact">
                  <dt>Quote</dt>
                  <dd>signed · signature verified</dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>Route</dt>
                  <dd>0.15 USDT → min 0.144683 USDC</dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>Status</dt>
                  <dd>PENDING_DEPOSIT</dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>Origin / destination tx</dt>
                  <dd>none</dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>Scope</dt>
                  <dd>mainnet only · real funds</dd>
                </div>
              </dl>
              <div className="hiw-proof__links">
                <ExplorerLink href={`${GITHUB_DOCS}/scripts/intents-live/LIVE-INTENTS.md`}>
                  Read the Intents record
                </ExplorerLink>
              </div>
              <p className="hiw-proof__note">
                No explorer link is shown because no deposit or destination transaction exists. A completed same-chain
                swap would still not prove cross-chain sponsorship.
              </p>
            </article>

            <article className="trust-page-card hiw-proof">
              <div className="hiw-proof__head">
                <div>
                  <p className="hiw-proof__id">mend-relayer.testnet</p>
                  <h3>NEP-366 relayer: real delegate, zero funds</h3>
                </div>
                <div className="hiw-proof__badges">
                  <Badge tone="positive">LIVE TESTNET</Badge>
                  <Badge tone="neutral">ZERO DEPOSIT</Badge>
                </div>
              </div>
              <p>
                A real NEP-366 delegate signed by mend-coordinator-ai.testnet was relayed to mend-hub.testnet and created
                the unfunded DRAFT WO-RELAYER-LIVE-0002. Replay, wrong receiver, wrong method and expiry were rejected at
                the gate and on chain.
              </p>
              <dl className="hiw-proof__facts">
                <div className="hiw-proof__fact">
                  <dt>Relayed method</dt>
                  <dd className="mono">create_work_order</dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>Work order</dt>
                  <dd className="mono">WO-RELAYER-LIVE-0002 · DRAFT</dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>Deposit</dt>
                  <dd>0</dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>Rejections</dt>
                  <dd>replay · wrong receiver · wrong method · expired</dd>
                </div>
                <div className="hiw-proof__fact">
                  <dt>Gasless funding</dt>
                  <dd>not supported</dd>
                </div>
              </dl>
              <div className="hiw-proof__links">
                <HashDisplay value={RELAYER_TX} label="Relayed tx" />
                <ExplorerLink href={`${EXPLORER}/transactions/${RELAYER_TX}`}>View relayed tx</ExplorerLink>
              </div>
              <p className="hiw-proof__note">
                The relayer is a hot wallet and only forwards allowlisted MEND methods. It cannot forward funding or
                payment methods.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section section--paper" aria-labelledby="labels-title">
        <div className="container">
          <SectionHead
            id="labels-title"
            eyebrow="Honest labels"
            title="What the labels mean, and what they do not"
            lead="The same green tick must never mean four different things. This page uses three explicit labels and one rule: no fake transaction links."
          />
          <div className="hiw-label-grid">
            <article className="hiw-label-card">
              <Badge tone="positive">LIVE TESTNET</Badge>
              <h3>Real testnet state or transaction</h3>
              <p>
                A contract account, transaction or execution on NEAR testnet. Test mUSDC and testnet NEAR have no real
                value; there is no mainnet authority.
              </p>
            </article>
            <article className="hiw-label-card">
              <Badge tone="warning">REPLAY / SIMULATION</Badge>
              <h3>Recorded or staged story</h3>
              <p>
                The pothole story is a replay. Repair footage is illustrative stock footage, not a MEND field job. The
                software scenario is not evidence of a physical repair.
              </p>
            </article>
            <article className="hiw-label-card">
              <Badge tone="warning">UNAVAILABLE</Badge>
              <h3>Missing or unverifiable evidence</h3>
              <p>
                Evidence that would strengthen the case but is not available, not bundled or not verifiable. It is shown
                with a reason and never promoted to verified. ATT-0001 is the example.
              </p>
            </article>
          </div>

          <div className="hiw-callout-grid">
            <Callout tone="positive" title="AI does not approve" icon={<ShieldCheck size={18} aria-hidden="true" />}>
              AI proposes classification, duplicate candidates and a draft scope. Humans scope, authorize, inspect and
              accept. The contract enforces roles and escrow arithmetic. No model can award, accept, refund or release
              funds.
            </Callout>
            <Callout tone="warning" title="The pothole is not a real repair" icon={<AlertTriangle size={18} aria-hidden="true" />}>
              The pothole story in the demo is REPLAY / SIMULATION. Repair footage is illustrative. The pilot scope is
              low-risk public assets; it does not claim road, electrical, gas or structural work. The live testnet evidence
              on this page is contract and transaction evidence, not a physical inspection of a road.
            </Callout>
            <Callout tone="warning" title="No fake transaction links" icon={<ExternalLink size={18} aria-hidden="true" />}>
              Transaction explorer links appear only for real transaction hashes. There is no transaction link for the
              work order itself, the unavailable AI attestation or the pending Intents quote. A labelled replay is honest
              only if every success claim is checked for the evidence that would make it true.
            </Callout>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="docs-title">
        <div className="container">
          <SectionHead
            id="docs-title"
            eyebrow="Read the receipts"
            title="Source documents, not marketing copy"
            lead="These are the committed records behind the cards above. Each link points to the repository document with the raw references and caveats."
          />
          <div className="hiw-docs">
            {docs.map((doc) => (
              <a
                className="hiw-doc"
                key={doc.path}
                href={`${GITHUB_DOCS}/${doc.path}`}
                target="_blank"
                rel="noreferrer"
              >
                <FileText className="hiw-doc__icon" size={17} aria-hidden="true" />
                <span>
                  <strong>{doc.title}</strong>
                  <span>{doc.detail}</span>
                  <code>{doc.path}</code>
                </span>
                <ExternalLink className="hiw-doc__arrow" size={14} aria-hidden="true" />
              </a>
            ))}
          </div>

          <div className="closing-cta" style={{ marginTop: 28 }}>
            <div>
              <p className="eyebrow">See it, then audit it</p>
              <h2>Watch the replay. Read the trust model.</h2>
              <p>
                The demo shows the recorded story. The trust page explains the evidence taxonomy, privacy model and the
                edges of the pilot.
              </p>
            </div>
            <div className="closing-cta__actions">
              <Link className="button button--light" href="/demo">
                Open the demo <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                className="button button--ghost"
                href="/trust"
                style={{ color: 'var(--paper)', borderColor: 'rgba(245,241,230,.3)' }}
              >
                Privacy &amp; trust
              </Link>
            </div>
          </div>

          <DataSourceNote detail="Static explainer; no live API call is made by this page. Card labels carry the evidence status: LIVE TESTNET for real testnet references, REPLAY / SIMULATION for the demo story and UNAVAILABLE where evidence is missing. The pothole story is replay and repair footage is illustrative." />
        </div>
      </section>
    </div>
  );
}
