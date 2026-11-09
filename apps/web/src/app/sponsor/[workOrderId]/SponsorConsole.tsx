'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { CaseBundle } from '@/lib/types';
import { formatDateTime, shortAccount, usdc } from '@/lib/format';
import { Badge, Callout, PageHero, StatusPill } from '@/components/ui';
import { MoneyRail } from '@/components/MoneyRail';
import { DataSourceNote } from '@/components/DataSourceNote';
import { CopyButton } from '@/components/CopyButton';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  Coins,
  ExternalLink,
  Lock,
  ShieldCheck,
  Wallet,
} from '@/components/Icons';

const STATUS_COPY: Record<
  CaseBundle['intent']['status'],
  { label: string; detail: string; tone: 'positive' | 'warning' | 'danger' | 'neutral' | 'active' }
> = {
  PENDING: {
    label: 'Pending',
    detail: 'Deposit or settlement is not complete. A pending quote must never be rendered as a payment.',
    tone: 'warning',
  },
  SUCCESS: {
    label: 'Success',
    detail: 'Destination delivery is complete. In a live run the UI requires a real destination transaction hash and reconciliation to this work order.',
    tone: 'positive',
  },
  FAILED: {
    label: 'Failed',
    detail: 'Funds were not delivered. Keep the quote as failed and request a new quote; never retry silently.',
    tone: 'danger',
  },
  REFUNDED: {
    label: 'Refunded',
    detail: 'The origin funds were refunded. Reconcile the refund against the original deposit; do not show the work order as funded.',
    tone: 'danger',
  },
  INCOMPLETE: {
    label: 'Incomplete',
    detail: 'Underpayment, partial delivery or a missing callback. Do not award work against an incomplete deposit.',
    tone: 'warning',
  },
  EXPIRED: {
    label: 'Expired',
    detail: 'The quote deadline passed. Request a fresh quote; an expired quote is not a promise of price or settlement.',
    tone: 'neutral',
  },
};

export function SponsorConsole({ caseData }: { caseData: CaseBundle }) {
  const quote = caseData.intent;
  const [preview, setPreview] = useState(quote.status);
  const previewCopy = STATUS_COPY[preview];
  const dry = quote.dry;
  const reconciled = Boolean(quote.destinationTxHash);

  return (
    <div className="container">
      <PageHero
        eyebrow="Sponsor & Intents"
        title="A quote is not a payment."
        lead="MEND shows the source asset, destination asset, fees, estimated output, deposit instructions and execution status without ever pretending that a dry quote moved money. Intents operates on mainnet only."
        aside={
          <div className="side-card">
            <h2>Work order</h2>
            <p className="side-card__value" style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)' }}>
              {caseData.id}
            </p>
            <p className="side-card__note">{caseData.title}</p>
            <div style={{ marginTop: 10 }}>
              <StatusPill status={caseData.status} />
            </div>
            <dl>
              <div>
                <dt>Budget</dt>
                <dd>{usdc(caseData.budgetMicro)}</dd>
              </div>
              <div>
                <dt>Funding token</dt>
                <dd className="mono">{caseData.fundingToken}</dd>
              </div>
              <div>
                <dt>Intent status</dt>
                <dd>{quote.status}</dd>
              </div>
            </dl>
          </div>
        }
      />

      <div className="intent-shell" style={{ paddingBottom: 'clamp(50px, 8vw, 90px)' }}>
        <div className="dry-live" role="note" aria-label="Quote mode">
          <span className="dry-pill">
            <Lock size={13} aria-hidden="true" /> DRY QUOTE · preview only
          </span>
          <span className="live-pill live-pill--disabled">
            <Wallet size={13} aria-hidden="true" /> LIVE QUOTE unavailable in replay
          </span>
          <Badge tone="danger">MAINNET ONLY</Badge>
        </div>

        <Callout tone="warning" title="Intents is a mainnet path. This build does not initiate a mainnet transaction.">
          A real Intents execution needs a separate human approval, real funds and a server-side API. No private key, API
          secret or mainnet signature exists in this browser.
        </Callout>

        <section className="quote-card" aria-labelledby="quote-title">
          <div className="quote-card__head">
            <div>
              <p className="eyebrow">1Click / Intents quote</p>
              <h2 id="quote-title">Sponsor preview · {quote.id}</h2>
            </div>
            <div className="dry-live">
              <span className="dry-pill">{dry ? 'dry: true' : 'dry: false'}</span>
              <span className="live-pill live-pill--disabled">live execution locked</span>
            </div>
          </div>

          <div className="quote-route" aria-label="Quote route">
            <div className="quote-asset">
              <span>Source</span>
              <strong>{quote.srcAsset}</strong>
              <small>{quote.srcChain}</small>
              <small>{quote.amountIn}</small>
            </div>
            <ArrowRight className="quote-arrow" size={22} aria-hidden="true" />
            <div className="quote-asset">
              <span>Destination</span>
              <strong>{quote.dstAsset}</strong>
              <small>NEAR</small>
              <small>to {shortAccount(quote.recipient)}</small>
            </div>
          </div>

          <div className="quote-facts">
            <div className="quote-fact">
              <span>Estimated output</span>
              <strong>{quote.amountOut}</strong>
            </div>
            <div className="quote-fact">
              <span>Quoted fees</span>
              <strong>${quote.feesUsd.toFixed(2)}</strong>
            </div>
            <div className="quote-fact">
              <span>Quote deadline</span>
              <strong style={{ fontSize: '0.74rem' }}>{formatDateTime(quote.deadline)}</strong>
            </div>
          </div>

          <div className="deposit">
            <h3>Deposit instructions (preview only)</h3>
            <div className="deposit__row">
              <span>Address</span>
              <code>{quote.depositAddress}</code>
              <CopyButton value={quote.depositAddress} label="Copy address" />
            </div>
            <div className="deposit__row">
              <span>Memo</span>
              <code>{quote.depositMemo}</code>
              <CopyButton value={quote.depositMemo} label="Copy memo" />
            </div>
            <p className="field__hint" style={{ marginTop: 8 }}>
              Do not send real funds to a replay address. In live mode, recipient binding and work-order metadata must be
              re-checked by a human before deposit.
            </p>
          </div>

          <div className="source-note source-note--replay">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>
              <strong>Fees and output are estimates.</strong> This quote is not a guarantee of price, delivery or
              settlement. A dry quote never makes the work order funded.
            </span>
          </div>
        </section>

        <section className="quote-card" aria-labelledby="intent-status-title">
          <div className="quote-card__head">
            <div>
              <p className="eyebrow">Execution status</p>
              <h2 id="intent-status-title">Every documented outcome, handled honestly</h2>
            </div>
            <Badge tone={previewCopy.tone}>{previewCopy.label}</Badge>
          </div>

          <div className="intent-statuses" aria-label="Intent status reference">
            {(Object.keys(STATUS_COPY) as CaseBundle['intent']['status'][]).map((status) => (
              <button
                key={status}
                type="button"
                className={`intent-status${preview === status ? ' is-current' : ''}${status === 'FAILED' || status === 'REFUNDED' ? ' is-failure' : ''}`}
                aria-pressed={preview === status}
                onClick={() => setPreview(status)}
              >
                {STATUS_COPY[status].label}
              </button>
            ))}
          </div>

          <div className="intent-steps" aria-label="Intent settlement steps">
            <div className={`intent-step${quote.status !== 'PENDING' ? ' intent-step--done' : ' intent-step--current'}`}>
              <span>1. Quote</span>
              <strong>{dry ? 'Dry' : 'Live'}</strong>
            </div>
            <div className={`intent-step${['SUCCESS', 'REFUNDED'].includes(quote.status) ? ' intent-step--done' : ''}${quote.status === 'PENDING' ? ' intent-step--current' : ''}`}>
              <span>2. Deposit</span>
              <strong>{quote.status === 'PENDING' ? 'Awaiting' : quote.status === 'FAILED' ? 'Failed' : 'Recorded'}</strong>
            </div>
            <div className={`intent-step${reconciled ? ' intent-step--done' : ''}${quote.status === 'INCOMPLETE' ? ' intent-step--failed' : ''}`}>
              <span>3. Deliver</span>
              <strong>{reconciled ? 'Delivered' : quote.status === 'SUCCESS' ? 'Fixture only' : quote.status === 'INCOMPLETE' ? 'Incomplete' : 'Pending'}</strong>
            </div>
            <div className={`intent-step${reconciled ? ' intent-step--done' : ''}${quote.status === 'FAILED' ? ' intent-step--failed' : ''}`}>
              <span>4. Reconcile</span>
              <strong>{reconciled ? 'Matched' : 'No tx hash'}</strong>
            </div>
            <div className={`intent-step${quote.status === 'SUCCESS' && reconciled ? ' intent-step--done' : ''}`}>
              <span>5. Fund order</span>
              <strong>{caseData.escrow.fundedMicro !== '0' ? 'Fixture recorded' : 'Not funded'}</strong>
            </div>
          </div>

          <div className={`callout callout--${previewCopy.tone === 'positive' ? 'positive' : previewCopy.tone === 'danger' ? 'danger' : 'warning'}`} style={{ marginTop: 16 }}>
            <div className="callout__icon">
              <Clock size={18} />
            </div>
            <div>
              <p className="callout__title">{previewCopy.label} handling</p>
              <div className="callout__body">{previewCopy.detail}</div>
            </div>
          </div>

          {quote.status === 'SUCCESS' && !reconciled ? (
            <p className="unavailable-reason" style={{ marginTop: 10 }}>
              <AlertTriangle size={14} aria-hidden="true" /> The recorded status says SUCCESS, but no destination transaction
              hash is bundled. This is not shown as a live payment or reconciliation.
            </p>
          ) : null}

          <div className="form-actions">
            <div>
              <p className="field__hint">Destination transaction</p>
              {quote.destinationTxHash ? (
                <a className="text-link" href={quote.explorerUrl} target="_blank" rel="noreferrer noopener">
                  View real transaction <ExternalLink size={14} aria-hidden="true" />
                </a>
              ) : (
                <p className="evidence-chip evidence-chip--tx" style={{ width: 'fit-content', marginTop: 4 }}>
                  <AlertTriangle size={13} aria-hidden="true" /> No explorer link — no real destination transaction hash
                </p>
              )}
            </div>
            <div className="form-actions__right">
              <Link className="button button--ghost button--small" href={`/cases/${caseData.id}`}>
                Full case <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <button type="button" className="button button--small" disabled title="Requires server credentials and separate human approval">
                <Lock size={15} aria-hidden="true" /> Request live quote
              </button>
            </div>
          </div>
        </section>

        <section className="quote-card" aria-labelledby="funding-state-title">
          <div className="quote-card__head">
            <div>
              <p className="eyebrow">Funding and payment state</p>
              <h2 id="funding-state-title">The work order, not the quote, is the source of truth</h2>
            </div>
            <Badge tone="neutral">
              <ShieldCheck size={14} aria-hidden="true" /> Hub escrow
            </Badge>
          </div>
          <dl className="facts-grid" style={{ marginTop: 16 }}>
            <div className="fact">
              <dt>Funded</dt>
              <dd>{usdc(caseData.escrow.fundedMicro)}</dd>
            </div>
            <div className="fact">
              <dt>Refunded</dt>
              <dd>{usdc(caseData.escrow.refundedMicro)}</dd>
            </div>
            <div className="fact">
              <dt>Still escrowed</dt>
              <dd>{usdc(caseData.escrow.escrowedMicro ?? '0')}</dd>
            </div>
            <div className="fact">
              <dt>Completion paid</dt>
              <dd>{usdc(caseData.escrow.completionPaidMicro)}</dd>
            </div>
            <div className="fact">
              <dt>Holdback held</dt>
              <dd>{usdc(caseData.escrow.holdbackHeldMicro)}</dd>
            </div>
            <div className="fact">
              <dt>Holdback released</dt>
              <dd>{usdc(caseData.escrow.holdbackReleasedMicro)}</dd>
            </div>
          </dl>
          <div className="rule-note">
            Funding must reconcile exactly to a work order before any award. Overpayment is returned; underpayment and
            incomplete settlement do not authorize work.
          </div>
        </section>

        <MoneyRail caseData={caseData} />

        <div className="card-grid">
          <article className="card">
            <span className="card__icon">
              <Coins size={20} />
            </span>
            <h3>Exact accounting</h3>
            <p>
              Funding equals refunds plus remaining escrow plus completion plus holdback. No quote, deposit or payment is
              inferred from a status label alone.
            </p>
          </article>
          <article className="card">
            <span className="card__icon">
              <Check size={20} />
            </span>
            <h3>Reconciled badge</h3>
            <p>
              In live mode, a SUCCESS label requires a destination transaction hash, output amount and work-order match
              before the funding state changes.
            </p>
          </article>
          <article className="card">
            <span className="card__icon">
              <Lock size={20} />
            </span>
            <h3>No browser secrets</h3>
            <p>
              Partner credentials stay server-side. The browser receives a quote object, never an API key, JWT or signing
              material.
            </p>
          </article>
        </div>

        <DataSourceNote detail={`Sponsor view for ${caseData.id}. The quote, fees and status are frozen replay fixtures. No mainnet transaction, deposit or payment is claimed.`} />
      </div>
    </div>
  );
}
