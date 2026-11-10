# MEND Testnet V2

Fresh NEAR testnet V2 deployment: current hub WASM, real Sputnik DAO v2, and a
complete authorized repair lifecycle.

## Evidence

- [`LIVE-V2.md`](./LIVE-V2.md) — accounts, proposal votes, transaction table,
  exact accounting and honest caveats.
- [`live-state.json`](./live-state.json) — machine-readable deployment and
  lifecycle state.
- [`attempts/aborted-deploy-1.json`](./attempts/aborted-deploy-1.json) — the
  discarded first attempt, kept for audit.

## Run

Signing keys live **outside** the repo, for example
`/Volumes/sandisk/Users/dc/.mend/testnet/keys.json` (mode 600).

```bash
# Rebuild the current hub WASM first
cargo build --target wasm32-unknown-unknown --release --manifest-path contracts/Cargo.toml

cd infra/testnet-v2
npm install

MEND_TESTNET_KEYS_FILE=/abs/path/keys.json node deploy-v2.mjs --deploy
MEND_TESTNET_KEYS_FILE=/abs/path/keys.json node deploy-v2.mjs --lifecycle
node deploy-v2.mjs --check
```

`--all` runs deploy and lifecycle in one process. `--check` is read-only and does
not need keys.

## Safety

- Testnet only: refuses mainnet networks, RPC hosts, account suffixes and keys.
- Never prints, copies into state, or commits secret keys.
- Refuses a destructive re-init of an existing hub with a different DAO or
  populated state.
- Records a failed Sputnik factory call verbatim; it never fakes a DAO.
- Steps are idempotent and keyed by step name, so a retried run cannot resolve
  an older attempt as current evidence.

## Notes

- Score mode is `LOCAL_DETERMINISTIC` (on-chain `mode = "recorded"`). OutLayer
  live execution was not used and no TEE attestation is claimed.
- The passport is non-transferable and held by the hub; it is not legal
  ownership.
- The Sputnik DAO is a real testnet DAO and has no mainnet authority.
