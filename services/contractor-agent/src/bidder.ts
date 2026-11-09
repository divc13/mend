import {
  BidCommitmentSchema,
  BidRevealSchema,
  FIXTURE_DAO_APPROVAL,
  MendError,
  bidCommitmentHash,
  makeEvent,
} from '@mend/protocol';
import type { BidCommitment, BidReveal, MendEvent } from '@mend/protocol';
import { assertContractorMethod } from './policy.js';
import { CONTRACTOR_STRATEGIES } from './strategies.js';
import type { ContractorStrategy, StrategyKey } from './strategies.js';

export interface AuctionWindow {
  commitDeadline: string;
  revealDeadline: string;
}

function at(iso: string): number {
  const value = Date.parse(iso);
  if (Number.isNaN(value)) throw new MendError('VALIDATION_ERROR', `invalid timestamp: ${iso}`);
  return value;
}

/** One isolated contractor agent, one sub-account, one deterministic strategy. */
export class ContractorBidder {
  readonly key: StrategyKey;
  readonly account: string;
  private readonly strategy: ContractorStrategy;

  constructor(key: StrategyKey) {
    this.key = key;
    this.strategy = CONTRACTOR_STRATEGIES[key];
    this.account = this.strategy.account;
  }

  createCommitment(workOrderId: string, committedAt: string): BidCommitment {
    const commitmentHash = bidCommitmentHash(this.strategy.bid);
    return BidCommitmentSchema.parse({
      workOrderId,
      bidId: this.strategy.bid.bidId,
      contractorId: this.account,
      commitmentHash,
      committedAt,
    });
  }

  createReveal(workOrderId: string, revealedAt: string): BidReveal {
    const commitmentHash = bidCommitmentHash(this.strategy.bid);
    return BidRevealSchema.parse({
      workOrderId,
      bidId: this.strategy.bid.bidId,
      contractorId: this.account,
      priceMicro: this.strategy.bid.priceMicro,
      durationDays: this.strategy.bid.durationDays,
      warrantyDays: this.strategy.bid.warrantyDays,
      materials: this.strategy.materialsDescription,
      materialsScore: this.strategy.bid.materialsScore,
      evidenceChecklistAccepted: this.strategy.bid.evidenceChecklistAccepted,
      nonce: this.strategy.bid.nonce,
      revealedAt,
      commitmentHash,
    });
  }

  verifyReveal(reveal: BidReveal): boolean {
    return (
      reveal.contractorId === this.account &&
      reveal.bidId === this.strategy.bid.bidId &&
      reveal.commitmentHash === bidCommitmentHash(this.strategy.bid)
    );
  }

  /** Explanation is a frozen fixture sentence over structured values only. */
  explain(): string {
    return this.strategy.explanation;
  }

  performAction(method: string): { account: string; method: string; signed: false } {
    assertContractorMethod(method);
    return { account: this.account, method, signed: false };
  }
}

export interface SealedBidMarketOptions {
  window: AuctionWindow;
  contractorRoster?: readonly string[];
  clock?: () => string;
}

/**
 * Public sealed-bid board. Commitments expose only a hash; reveals are
 * unreadable before the reveal deadline and are verified against commitments.
 */
export class SealedBidMarket {
  private readonly window: AuctionWindow;
  private readonly roster: readonly string[];
  private readonly clock: () => string;
  private readonly commitments = new Map<string, Map<string, BidCommitment>>();
  private readonly reveals = new Map<string, Map<string, BidReveal>>();
  private readonly audit: MendEvent[] = [];

  constructor(options: SealedBidMarketOptions) {
    this.window = options.window;
    this.roster = options.contractorRoster ?? FIXTURE_DAO_APPROVAL.contractorRoster;
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  get events(): readonly MendEvent[] {
    return [...this.audit];
  }

  commit(bidder: ContractorBidder, workOrderId: string, now = this.clock()): BidCommitment {
    if (!this.roster.includes(bidder.account)) {
      throw new MendError('NOT_ROSTERED', `${bidder.account} is not on the approved contractor roster`);
    }
    if (at(now) > at(this.window.commitDeadline)) {
      throw new MendError('BID_LATE', 'commit deadline has passed');
    }
    const existing = this.commitments.get(workOrderId) ?? new Map<string, BidCommitment>();
    if (existing.has(bidder.account)) {
      throw new MendError('BID_DUPLICATE', `${bidder.account} already committed on ${workOrderId}`);
    }
    const commitment = bidder.createCommitment(workOrderId, now);
    existing.set(bidder.account, commitment);
    this.commitments.set(workOrderId, existing);
    this.audit.push(
      makeEvent(
        'bid_committed',
        { bidId: commitment.bidId, contractorId: commitment.contractorId, commitmentHash: commitment.commitmentHash },
        { actor: bidder.account, workOrderId, timestamp: now },
      ),
    );
    return commitment;
  }

  /** Only hashes are public while bidding is sealed. */
  publicCommitments(workOrderId: string): readonly BidCommitment[] {
    const entries = this.commitments.get(workOrderId);
    return entries ? [...entries.values()].map((commitment) => ({ ...commitment })) : [];
  }

  reveal(bidder: ContractorBidder, workOrderId: string, now = this.clock()): BidReveal {
    if (at(now) < at(this.window.commitDeadline)) {
      throw new MendError('BID_EARLY_REVEAL', 'reveal is not open until the commit deadline');
    }
    if (at(now) > at(this.window.revealDeadline)) {
      throw new MendError('BID_LATE', 'reveal deadline has passed');
    }
    const commitment = this.commitments.get(workOrderId)?.get(bidder.account);
    if (!commitment) {
      throw new MendError('NOT_FOUND', `${bidder.account} has no commitment on ${workOrderId}`);
    }
    const reveal = bidder.createReveal(workOrderId, now);
    if (reveal.commitmentHash !== commitment.commitmentHash || !bidder.verifyReveal(reveal)) {
      throw new MendError('BID_HASH_MISMATCH', 'revealed bid does not match the committed hash');
    }
    const existing = this.reveals.get(workOrderId) ?? new Map<string, BidReveal>();
    if (existing.has(bidder.account)) {
      throw new MendError('BID_DUPLICATE', `${bidder.account} already revealed on ${workOrderId}`);
    }
    existing.set(bidder.account, reveal);
    this.reveals.set(workOrderId, existing);
    this.audit.push(
      makeEvent(
        'bid_revealed',
        {
          bidId: reveal.bidId,
          contractorId: reveal.contractorId,
          priceMicro: reveal.priceMicro,
          durationDays: reveal.durationDays,
          warrantyDays: reveal.warrantyDays,
          materialsScore: reveal.materialsScore,
        },
        { actor: bidder.account, workOrderId, timestamp: now },
      ),
    );
    return reveal;
  }

  /** Refuses to expose reveals before the reveal phase opens. */
  revealedBids(workOrderId: string, now = this.clock()): readonly BidReveal[] {
    if (at(now) < at(this.window.commitDeadline)) {
      throw new MendError('BID_EARLY_REVEAL', 'competing bids are sealed until the reveal phase');
    }
    const entries = this.reveals.get(workOrderId);
    return entries ? [...entries.values()].map((reveal) => ({ ...reveal })) : [];
  }
}
