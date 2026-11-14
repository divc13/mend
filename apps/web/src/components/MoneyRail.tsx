import Link from 'next/link';
import type { CaseBundle } from '@/lib/types';
import { formatDateTime, microToUsdc, usdc } from '@/lib/format';
import { StatusPill } from './ui';
import { ArrowRight, Coins } from './Icons';

export function MoneyRail({
  caseData,
  source = 'fixture',
}: {
  caseData: CaseBundle;
  source?: 'fixture' | 'api';
}) {
  const escrow = caseData.escrow;
  const accounted =
    BigInt(escrow.refundedMicro) +
    BigInt(escrow.escrowedMicro ?? '0') +
    BigInt(escrow.completionPaidMicro) +
    BigInt(escrow.holdbackHeldMicro) +
    BigInt(escrow.holdbackReleasedMicro);
  const funding = BigInt(escrow.fundedMicro);
  const balanced = accounted === funding;

  const steps = [
    {
      label: 'Sponsor budget',
      value: escrow.fundedMicro,
      note: 'Funded into escrow',
      tone: 'neutral',
      href: `/sponsor/${caseData.id}`,
    },
    {
      label: 'Unawarded refund',
      value: escrow.refundedMicro,
      note: caseData.status === 'CLOSED' ? 'Returned to sponsor' : 'Refunded or still available',
      tone: 'refund',
    },
    {
      label: 'Completion payment',
      value: escrow.completionPaidMicro,
      note:
        BigInt(escrow.escrowedMicro ?? '0') > 0n
          ? `${usdc(escrow.escrowedMicro ?? '0')} still held in escrow`
          : '90% after independent acceptance',
      tone: 'paid',
    },
    {
      label: 'Durability holdback',
      value: BigInt(escrow.holdbackReleasedMicro) + BigInt(escrow.holdbackHeldMicro),
      note:
        BigInt(escrow.holdbackHeldMicro) > 0n
          ? `${usdc(escrow.holdbackHeldMicro)} still held`
          : '10% released after durability pass',
      tone: 'held',
    },
  ] as const;

  return (
    <section className="money-rail" aria-labelledby="money-rail-title">
      <div className="money-rail__head">
        <div>
          <p className="eyebrow">Payment rail</p>
          <h2 id="money-rail-title">Every cent accounted for</h2>
        </div>
        <span className={`ledger-check${balanced ? ' ledger-check--ok' : ' ledger-check--bad'}`}>
          {balanced ? 'Ledger balanced' : 'Ledger mismatch'} · {microToUsdc(funding)} ={' '}
          {microToUsdc(accounted)}
        </span>
      </div>

      <div className="money-flow">
        {steps.map((step) => (
          <div key={step.label} className={`money-step money-step--${step.tone}`}>
            <p className="money-step__label">{step.label}</p>
            <p className="money-step__value">{usdc(step.value)}</p>
            <p className="money-step__note">{step.note}</p>
          </div>
        ))}
      </div>

      <div className="payment-list">
        <div className="payment-list__head">
          <h3>Payment history</h3>
          <span className="mono">{escrow.token}</span>
        </div>
        {caseData.payments.length === 0 ? (
          <p className="muted">No payment has been released. Funding remains in escrow.</p>
        ) : (
          <table className="data-table">
            <caption className="sr-only">Payments recorded for {caseData.id}</caption>
            <thead>
              <tr>
                <th scope="col">Kind</th>
                <th scope="col">Amount</th>
                <th scope="col">Recipient</th>
                <th scope="col">Status</th>
                <th scope="col">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {caseData.payments.map((payment) => (
                <tr key={payment.id}>
                  <td data-label="Kind">
                    <Coins size={14} aria-hidden="true" /> {payment.kind.toLowerCase()}
                  </td>
                  <td data-label="Amount">{usdc(payment.amountMicro)}</td>
                  <td data-label="Recipient" className="mono">
                    {payment.recipient}
                  </td>
                  <td data-label="Status">
                    <span className={`payment-status payment-status--${payment.status.toLowerCase()}`}>
                      {payment.status}
                    </span>
                  </td>
                  <td data-label="Recorded">{payment.releasedAt ? formatDateTime(payment.releasedAt) : 'Not released'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="money-rail__foot">
        <p>
          A completion payment and holdback are calculated exactly once. A closed work order cannot be paid again. A
          warranty reopening creates no new escrow.
        </p>
        <Link className="text-link" href={`/sponsor/${caseData.id}`}>
          Open sponsor &amp; Intents view <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>

      {caseData.payments.some((payment) => payment.txHash) ? (
        <p className="source-note source-note--live">
          Explorer links are shown only where a real transaction hash exists.
        </p>
      ) : (
        <p className="source-note source-note--replay">
          {source === 'api'
            ? 'No payment above carries a transaction hash in the API response, so no explorer link is shown.'
            : 'No payment above carries a real transaction hash in this replay fixture, so no explorer link is shown.'}
        </p>
      )}

      <div className="money-rail__status">
        <span>Work order state</span>
        <StatusPill status={caseData.status} />
      </div>
    </section>
  );
}
