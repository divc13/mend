# 11 — Limitations

MEND is a working protocol design with a tested local core and an in-progress
application. It is **not** a finished production system, not audited, and not
deployed. This page lists the limits that matter to a judge, operator, sponsor or
reporter.

If a claim is not supported here or in
[16 — Integration evidence](./16-integration-evidence.md), treat it as unproven.

## Current evidence limits

| Claim | Current reality |
|---|---|
| Live testnet lifecycle | **BLOCKED_ON_HUMAN** — no accounts, deployed contracts or transactions |
| Mainnet Intents execution | **BLOCKED_ON_HUMAN** — mainnet only; no funds, no approval |
| OutLayer live scoring | **BLOCKED_ON_HUMAN** — no published MEND WASM or funded execution |
| NEAR AI authenticated inference | **BLOCKED_ON_HUMAN** — no API key or credits |
| Sputnik DAO deployment | **BLOCKED_ON_HUMAN** — no DAO or council |
| Agent Market live job | **BLOCKED_ON_HUMAN** — no account/token/balance |
| Hosted demo | **BLOCKED_ON_HUMAN** — no deployment credentials |
| Demo video | **NOT COLLECTED** — no capture exists |
| Before/after repair media | **NOT COLLECTED** — no repair has been performed for MEND |
| Physical durability verification | **NOT COLLECTED** — no durability inspection has happened |
| Real users or city adoption | **NONE** — no city, municipality or community has adopted MEND |
| Partnerships | **NONE** — no partner, sponsor or vendor relationship is claimed |
| Security audit | **NONE** — no third-party audit has been performed |
| Accessibility certification | **NONE** — target is WCAG 2.2 AA; audit is pending |

## Technical limits

### External services

- **NEAR AI attestation is not a complete end-to-end chain.** Gateway evidence and
  model evidence are separate. A signature proves the gateway signed bytes; it
  does not prove the model instance produced them. MEND must show the layers
  separately.
- **Signatures are post-hoc and keyed.** A 404 or a `200` with an error body means
  `UNAVAILABLE`, not “probably fine”.
- **OutLayer TEE proves execution, not correctness.** It does not prove the binary
  matches published source. The coordinator is closed source and can censor.
- **OutLayer can be unavailable.** The local fallback is deterministic but not
  TEE-attested and must be labelled.
- **1Click is mainnet-only.** There is no testnet. Live deposits cannot be
  rehearsed safely; they require human approval and real funds.
- **1Click status has no `EXPIRED` value.** Expiry is client-side. Explorer URLs
  were empty in a live SUCCESS sample, so MEND builds links itself.
- **Agent Market has no worker accept endpoint.** A human/buyer must accept, or the
  auto-accept window expires. It is a production marketplace, not a testnet.
- **NEAR AI signatures and OutLayer attestations can rotate or disappear.** Verify
  promptly and store the verified artifact; a historical measurement set may be
  removed.

### NEAR platform

- **Gasless escrow funding is not possible with a function-call key.**
  `ft_transfer_call` requires a 1-yoctoNEAR deposit; function-call keys reject
  deposits. Funding uses a funded wallet, sponsor account or Intents.
- **The passport is a custom non-transferable NEP-171 implementation.** There is no
  standard `non_transferable` flag. Third-party marketplaces or indexers may not
  understand it. It is not listed for sale and confers no legal ownership.
- **Runtime behaviour is source-verified, not yet testnet-proven.** Gas, refund
  and meta-transaction edge cases need sandbox/testnet evidence.
- **The relayer is a hot wallet.** NEP-366 requires a full-access key for the outer
  transaction. Isolation, minimal balance, rotation and monitoring are mandatory.
- **Storage registration is a deployment prerequisite.** The hub must be
  registered with the settlement token before funding.

### Application

- The web app, API, contracts, compute, services and infrastructure are
  `PENDING INTEGRATION` on this branch. Architecture paths are real, but the code
  is not here.
- The indexer can lag; the UI must show `INDEXING`.
- No load, performance, soak or disaster-recovery test has been run.
- No multi-region or high-availability deployment exists.
- No production migration or backup/restore drill has been run.
- The demo durability interval is configured in minutes. It is a demo control, not
  evidence about real-world durability.

## Privacy and legal limits

- This documentation is **not** a legal privacy notice or terms of service.
- Retention periods and data-subject processes are proposed, not approved by
  counsel or a data-protection authority.
- On-chain hashes and history are permanent. MEND cannot promise full erasure of
  public chain data.
- AI provider retention/training terms must be reviewed before a production pilot.
- Media consent, property permission and identifiable-person releases are human
  responsibilities. Templates exist in
  [12 — Real-world evidence package](./12-real-world-evidence-package.md), but no
  consent has been collected.
- Sponsor wallet addresses are public on-chain. MEND does not attach a real-world
  identity to them without consent.

## Security limits

- No third-party audit, penetration test or bug bounty.
- The prompt-injection, privacy, API-authorization and contract adversarial suites
  are planned, not passing.
- A compromised human inspector or DAO can still make a bad decision; the contract
  enforces separation, not honesty.
- A compromised relayer or owner key is a central risk.
- Dependency supply-chain risk is mitigated by lockfiles and review, not
  eliminated.
- No formal verification of the contract or the WASM scorer.

## Measurement limits

- "Durability" in the demo means a later human inspection after a configured
  interval. It is not a statistical claim about repair lifespan.
- The scoring policy is a demo policy (`mend-bid-policy-v1`), not a universal
  public-interest policy. A DAO can choose another policy, but it must be approved
  and hash-pinned.
- The canonical bids are fixtures. They demonstrate deterministic ranking, not
  market competition.
- The 100/80/72/8 example is one canonical case, not a promise about every repair.

## Product and ecosystem limits

- No city, municipality, NGO or community organization has adopted MEND.
- No partnership, sponsorship or endorsement is claimed.
- No real contractor or inspector has been onboarded.
- No reputation system is live; Agent Market reputation is external and may not
  reflect MEND work.
- The public map, case timeline, passport page, dashboard and trust center are
  designed but not present on this branch.
- Mobile and screen-reader behaviour has not been audited.

## What would need to change before production

1. Merge and test the full application, contracts and services.
2. Deploy to testnet with real accounts and run the canonical lifecycle.
3. Run contract adversarial, prompt-injection, privacy, API-auth and E2E suites.
4. Complete a third-party security review.
5. Verify WASM/source provenance and TEE evidence end-to-end.
6. Approve privacy retention, consent and legal terms.
7. Run accessibility and performance audits.
8. Establish incident response, key rotation and backup/restore drills.
9. Collect consented real repair media and a durability inspection.
10. Obtain explicit human approval for every public claim, post and submission.

## Non-claims

MEND does **not** claim:

- that any repair is structurally safe or certified;
- that AI approved, verified or guaranteed a repair;
- that a passport is legal ownership or a transferable asset;
- that a dry quote is a payment;
- that a replay is a live transaction;
- that a city, partner or sponsor endorses the project;
- that the system is audited, production-ready or complete.

## Related documents

- [09 — Failure cases](./09-failure-cases.md)
- [10 — Deployment guide](./10-deployment-guide.md)
- [16 — Integration evidence](./16-integration-evidence.md)
- [17 — Copy and accessibility](./17-copy-and-accessibility.md)

---

[Docs index](./README.md) · [← Deployment guide](./10-deployment-guide.md) · [Next: real-world evidence package →](./12-real-world-evidence-package.md)
