-- Server-side record for testnet onboarding wallets.
--
-- Only the public account id and public key are stored. The one-time secret key
-- is returned to the caller exactly once by POST /v1/testnet/wallet and is never
-- persisted, logged or written to an audit event.

CREATE TABLE IF NOT EXISTS testnet_wallets (
  account_id          TEXT PRIMARY KEY CHECK (account_id ~ '^[a-z0-9._-]{2,64}$'),
  public_key          TEXT NOT NULL CHECK (public_key LIKE 'ed25519:%'),
  network             TEXT NOT NULL CHECK (network = 'testnet'),
  created_at          TIMESTAMPTZ NOT NULL,
  last_faucet_at      TIMESTAMPTZ,
  last_faucet_ip_hash TEXT CHECK (last_faucet_ip_hash IS NULL OR last_faucet_ip_hash ~ '^[a-f0-9]{64}$'),
  faucet_count        INTEGER NOT NULL DEFAULT 0 CHECK (faucet_count >= 0)
);
