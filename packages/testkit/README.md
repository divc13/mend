# @mend/testkit

Deterministic test doubles and assertion helpers for MEND.

- **Clock** — `fixedClock(start)`, `clock.advance(ms)`, `advance(clock, ms)`.
- **IDs** — `idSequence(prefix)`, `sequenceIds(prefix, count)`.
- **Fixtures** — `loadCanonicalFixtures()` returns the typed
  `@mend/protocol` canonical values by reference. No filesystem access.
- **Chain** — `InMemoryChainCommandAdapter` records INTENT and moves through
  PENDING/SUCCESS/FAILED. A SUCCESS result always has a deterministic
  `fake:<sha256>` hash and is always labelled fake; `assertHonestChainResult`
  rejects a hashless success.
- **Evidence** — `InMemoryEvidenceStore` with HMAC-signed, expiring access
  tokens and a private in-memory object map.
- **RNG** — `createRng(seed)` (mulberry32) with `int`, `pick`, `shuffle`, `hex`.
- **Assertions** — `assertCanonicalLedger('award' | 'completion' |
  'holdback-released')` checks the exact 100/80/72/8 accounting, and
  `assertModeLabel(mode)` checks labels including the mandatory REPLAY /
  TESTNET / MAINNET disclosure.

All helpers are test-only. They never claim a real transaction or real private
storage, and importing the package has no side effects.
