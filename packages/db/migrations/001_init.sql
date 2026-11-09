-- MEND initial schema. Forward-only migration (see 001_init.down.sql for a
-- local-only manual teardown used by developers, never by production tooling).
--
-- Postgres is a read model and private-data index. The hub contract remains the
-- financial source of truth. Amounts are exact integer micro-units stored as
-- text so no JavaScript/Postgres float can lose precision.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS id_sequences (
  name       TEXT PRIMARY KEY,
  next_value INTEGER NOT NULL CHECK (next_value >= 1)
);

CREATE TABLE IF NOT EXISTS assets (
  id                 TEXT PRIMARY KEY CHECK (id ~ '^[A-Z]{2,12}-[0-9]{3}$'),
  public_description TEXT NOT NULL CHECK (length(public_description) BETWEEN 1 AND 2000),
  asset_type         TEXT NOT NULL CHECK (asset_type IN ('bench','bicycle_rack','fence','door','playground','other')),
  public_location    JSONB NOT NULL,
  passport_token_id  TEXT,
  created_at         TIMESTAMPTZ NOT NULL,
  is_demo            BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS report_clusters (
  id              TEXT PRIMARY KEY CHECK (id ~ '^CL-[0-9]{4}$'),
  report_ids      TEXT[] NOT NULL CHECK (cardinality(report_ids) >= 1),
  confidence_bps  INTEGER NOT NULL CHECK (confidence_bps BETWEEN 0 AND 10000),
  rationale       TEXT NOT NULL CHECK (length(rationale) <= 2000),
  status          TEXT NOT NULL CHECK (status IN ('SUGGESTED','CONFIRMED','REJECTED')),
  confirmed_by    TEXT,
  created_at      TIMESTAMPTZ NOT NULL,
  is_demo         BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS reports (
  id                  TEXT PRIMARY KEY CHECK (id ~ '^R-[0-9]{3}$'),
  asset_id            TEXT NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  description         TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 4000),
  public_location     JSONB NOT NULL,
  redacted_media_hash TEXT CHECK (redacted_media_hash IS NULL OR redacted_media_hash ~ '^[a-f0-9]{64}$'),
  perceptual_hash     TEXT CHECK (perceptual_hash IS NULL OR length(perceptual_hash) BETWEEN 8 AND 128),
  exif_stripped       BOOLEAN NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('SUBMITTED','TRIAGED','CLUSTERED','DUPLICATE','ACCEPTED')),
  cluster_id          TEXT REFERENCES report_clusters(id) ON DELETE SET NULL,
  source              TEXT NOT NULL DEFAULT 'WALLETLESS' CHECK (source IN ('WALLETLESS','ACCOUNT')),
  created_at          TIMESTAMPTZ NOT NULL,
  is_demo             BOOLEAN NOT NULL DEFAULT false
);

-- Private report fields live apart from the public report row. No public query
-- joins this table. Precise coordinates and media keys must never be exposed.
CREATE TABLE IF NOT EXISTS report_private (
  report_id          TEXT PRIMARY KEY REFERENCES reports(id) ON DELETE CASCADE,
  precise_location   JSONB,
  reporter_case_link TEXT NOT NULL,
  case_link_hash     TEXT NOT NULL UNIQUE CHECK (case_link_hash ~ '^[a-f0-9]{64}$'),
  private_media_key  TEXT,
  private_media_hash TEXT,
  retention_until    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS dao_approvals (
  id                TEXT PRIMARY KEY,
  dao_account       TEXT NOT NULL,
  proposal_id       TEXT NOT NULL CHECK (proposal_id ~ '^[0-9]{1,10}$'),
  budget_micro      TEXT NOT NULL CHECK (budget_micro ~ '^[0-9]+$'),
  contractor_roster TEXT[] NOT NULL CHECK (cardinality(contractor_roster) >= 1),
  inspector_roster  TEXT[] NOT NULL CHECK (cardinality(inspector_roster) >= 1),
  policy_hash       TEXT NOT NULL CHECK (policy_hash ~ '^[a-f0-9]{64}$'),
  state             TEXT NOT NULL CHECK (state IN ('PROPOSED','APPROVED','REJECTED','EXPIRED')),
  approved_at       TIMESTAMPTZ,
  is_demo           BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (dao_account, proposal_id)
);

CREATE TABLE IF NOT EXISTS work_orders (
  id                TEXT PRIMARY KEY CHECK (id ~ '^WO-[A-Z0-9-]+-[0-9]{4}$'),
  asset_id          TEXT NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  report_cluster_id TEXT NOT NULL REFERENCES report_clusters(id) ON DELETE RESTRICT,
  scope_hash        TEXT NOT NULL CHECK (scope_hash ~ '^[a-f0-9]{64}$'),
  dao_approval_id   TEXT NOT NULL REFERENCES dao_approvals(id) ON DELETE RESTRICT,
  policy_hash       TEXT NOT NULL CHECK (policy_hash ~ '^[a-f0-9]{64}$'),
  budget_micro      TEXT NOT NULL CHECK (budget_micro ~ '^[0-9]+$' AND budget_micro::numeric > 0),
  status            TEXT NOT NULL CHECK (status IN (
    'DRAFT','POLICY_APPROVED','FUNDED','BIDDING_OPEN','BIDDING_REVEAL','SCORED','AWARDED',
    'IN_PROGRESS','COMPLETION_SUBMITTED','COMPLETION_ACCEPTED','DURABILITY_PENDING','CLOSED',
    'WARRANTY_REOPENED','DISPUTED','CANCELLED','REFUNDED','FUNDING_FAILED','PAUSED')),
  mode              TEXT NOT NULL CHECK (mode IN ('LIVE_TESTNET','MAINNET','REPLAY')),
  awarded_bid_id    TEXT,
  contractor_id     TEXT,
  inspector_id      TEXT,
  sponsor_id        TEXT,
  funding_token     TEXT NOT NULL,
  funding_tx_hash   TEXT,
  durability_due_at TIMESTAMPTZ,
  commit_deadline   TIMESTAMPTZ,
  reveal_deadline   TIMESTAMPTZ,
  paused_from       TEXT,
  reopen_count      INTEGER NOT NULL DEFAULT 0 CHECK (reopen_count >= 0),
  created_at        TIMESTAMPTZ NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL,
  is_demo           BOOLEAN NOT NULL DEFAULT false,
  CHECK (paused_from IS NULL OR paused_from IN (
    'DRAFT','POLICY_APPROVED','FUNDED','BIDDING_OPEN','BIDDING_REVEAL','SCORED','AWARDED',
    'IN_PROGRESS','COMPLETION_SUBMITTED','COMPLETION_ACCEPTED','DURABILITY_PENDING','CLOSED',
    'WARRANTY_REOPENED','DISPUTED','CANCELLED','REFUNDED','FUNDING_FAILED'))
);

CREATE TABLE IF NOT EXISTS bid_commitments (
  work_order_id  TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  bid_id         TEXT NOT NULL CHECK (bid_id ~ '^BID-[A-Z]-[A-Z0-9-]+$'),
  contractor_id  TEXT NOT NULL,
  commitment_hash TEXT NOT NULL CHECK (commitment_hash ~ '^[a-f0-9]{64}$'),
  committed_at   TIMESTAMPTZ NOT NULL,
  is_demo        BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (work_order_id, bid_id),
  UNIQUE (work_order_id, contractor_id)
);

CREATE TABLE IF NOT EXISTS bid_reveals (
  work_order_id   TEXT NOT NULL,
  bid_id          TEXT NOT NULL,
  contractor_id   TEXT NOT NULL,
  price_micro     TEXT NOT NULL CHECK (price_micro ~ '^[0-9]+$' AND price_micro::numeric > 0),
  duration_days   INTEGER NOT NULL CHECK (duration_days > 0),
  warranty_days   INTEGER NOT NULL CHECK (warranty_days >= 0),
  materials       TEXT NOT NULL DEFAULT '' CHECK (length(materials) <= 1000),
  materials_score INTEGER NOT NULL CHECK (materials_score BETWEEN 0 AND 100),
  evidence_checklist_accepted BOOLEAN NOT NULL,
  nonce           TEXT NOT NULL CHECK (length(nonce) BETWEEN 8 AND 128),
  revealed_at     TIMESTAMPTZ NOT NULL,
  commitment_hash TEXT NOT NULL CHECK (commitment_hash ~ '^[a-f0-9]{64}$'),
  is_demo         BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (work_order_id, bid_id),
  FOREIGN KEY (work_order_id, bid_id) REFERENCES bid_commitments(work_order_id, bid_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS score_executions (
  id                 TEXT PRIMARY KEY,
  work_order_id      TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  policy_hash        TEXT NOT NULL CHECK (policy_hash ~ '^[a-f0-9]{64}$'),
  wasm_hash          TEXT NOT NULL CHECK (wasm_hash ~ '^[a-f0-9]{64}$'),
  input_hash         TEXT NOT NULL CHECK (input_hash ~ '^[a-f0-9]{64}$'),
  output_hash        TEXT NOT NULL CHECK (output_hash ~ '^[a-f0-9]{64}$'),
  ranking            JSONB NOT NULL,
  execution_ref      TEXT,
  verified           BOOLEAN NOT NULL DEFAULT false,
  unavailable_reason TEXT,
  created_at         TIMESTAMPTZ NOT NULL,
  is_demo            BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS evidence_packages (
  id               TEXT PRIMARY KEY,
  work_order_id    TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('COMPLETION','REMEDIATION','DURABILITY')),
  evidence_hashes  TEXT[] NOT NULL CHECK (cardinality(evidence_hashes) >= 1),
  checklist        JSONB NOT NULL,
  redacted         BOOLEAN NOT NULL DEFAULT true CHECK (redacted = true),
  submitted_by     TEXT NOT NULL,
  submitted_at     TIMESTAMPTZ NOT NULL,
  is_demo          BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS evidence_objects (
  id                 TEXT PRIMARY KEY,
  evidence_package_id TEXT NOT NULL REFERENCES evidence_packages(id) ON DELETE CASCADE,
  storage_key        TEXT NOT NULL UNIQUE,
  sha256             TEXT NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  content_type       TEXT NOT NULL,
  size_bytes         BIGINT NOT NULL CHECK (size_bytes >= 0),
  redacted           BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS inspections (
  id                  TEXT PRIMARY KEY,
  work_order_id       TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  kind                TEXT NOT NULL CHECK (kind IN ('COMPLETION','DURABILITY','REMEDIATION')),
  inspector_id        TEXT NOT NULL,
  decision            TEXT NOT NULL CHECK (decision IN ('APPROVED','REJECTED')),
  evidence_package_id TEXT NOT NULL,
  notes_hash          TEXT CHECK (notes_hash IS NULL OR notes_hash ~ '^[a-f0-9]{64}$'),
  signed_at           TIMESTAMPTZ NOT NULL,
  tx_hash             TEXT,
  is_demo             BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS escrow_accounts (
  work_order_id       TEXT PRIMARY KEY REFERENCES work_orders(id) ON DELETE CASCADE,
  token               TEXT NOT NULL,
  funded_micro        TEXT NOT NULL CHECK (funded_micro ~ '^[0-9]+$'),
  refunded_micro      TEXT NOT NULL DEFAULT '0' CHECK (refunded_micro ~ '^[0-9]+$'),
  completion_paid_micro TEXT NOT NULL DEFAULT '0' CHECK (completion_paid_micro ~ '^[0-9]+$'),
  holdback_held_micro TEXT NOT NULL DEFAULT '0' CHECK (holdback_held_micro ~ '^[0-9]+$'),
  holdback_released_micro TEXT NOT NULL DEFAULT '0' CHECK (holdback_released_micro ~ '^[0-9]+$'),
  is_demo             BOOLEAN NOT NULL DEFAULT false,
  CHECK (funded_micro::numeric >=
    refunded_micro::numeric + completion_paid_micro::numeric +
    holdback_held_micro::numeric + holdback_released_micro::numeric)
);

CREATE TABLE IF NOT EXISTS payments (
  id            TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('COMPLETION','HOLDBACK','REFUND')),
  amount_micro  TEXT NOT NULL CHECK (amount_micro ~ '^[0-9]+$' AND amount_micro::numeric > 0),
  recipient     TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('INTENT','PENDING','SUCCESS','FAILED')),
  tx_hash       TEXT,
  released_at   TIMESTAMPTZ,
  label         TEXT,
  created_at    TIMESTAMPTZ NOT NULL,
  is_demo       BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS warranty_cases (
  id                  TEXT PRIMARY KEY,
  work_order_id       TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  failed_inspection_id TEXT NOT NULL,
  state               TEXT NOT NULL CHECK (state IN ('OPEN','REMEDIATING','CLOSED')),
  opened_at           TIMESTAMPTZ NOT NULL,
  closed_at           TIMESTAMPTZ,
  is_demo             BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS agent_identities (
  account          TEXT NOT NULL,
  role             TEXT NOT NULL CHECK (role IN (
    'REPORTER','STEWARD','SPONSOR','CONTRACTOR','INSPECTOR','DAO','COORDINATOR_AI',
    'REVIEWER_AI','RELAYER','ADMIN')),
  key_kind         TEXT NOT NULL CHECK (key_kind IN ('FUNCTION_CALL','HUMAN_WALLET','CONTRACT')),
  allowed_receiver TEXT NOT NULL,
  allowed_methods  TEXT[] NOT NULL CHECK (cardinality(allowed_methods) >= 1),
  allowance_micro  TEXT CHECK (allowance_micro IS NULL OR allowance_micro ~ '^[0-9]+$'),
  can_release_escrow BOOLEAN NOT NULL DEFAULT false CHECK (can_release_escrow = false),
  label            TEXT NOT NULL,
  is_demo          BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (account, role)
);

CREATE TABLE IF NOT EXISTS attestations (
  id                 TEXT PRIMARY KEY,
  kind               TEXT NOT NULL CHECK (kind IN ('NEAR_AI','OUTLAYER','DAO','TRANSACTION','HUMAN','LOCAL_REPLAY')),
  subject_hash       TEXT NOT NULL CHECK (subject_hash ~ '^[a-f0-9]{64}$'),
  artifact           JSONB NOT NULL,
  artifact_hash      TEXT NOT NULL CHECK (artifact_hash ~ '^[a-f0-9]{64}$'),
  signature          TEXT,
  verified           BOOLEAN NOT NULL DEFAULT false,
  unavailable_reason TEXT,
  created_at         TIMESTAMPTZ NOT NULL,
  is_demo            BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS intent_quotes (
  id              TEXT PRIMARY KEY,
  dry             BOOLEAN NOT NULL,
  src_chain       TEXT NOT NULL,
  src_asset       TEXT NOT NULL,
  dst_chain       TEXT NOT NULL DEFAULT 'near' CHECK (dst_chain = 'near'),
  dst_asset       TEXT NOT NULL,
  amount_in       TEXT NOT NULL,
  amount_out      TEXT NOT NULL,
  fees_usd        DOUBLE PRECISION CHECK (fees_usd IS NULL OR fees_usd >= 0),
  recipient       TEXT NOT NULL,
  deposit_address TEXT,
  deposit_memo    TEXT,
  deadline        TIMESTAMPTZ,
  status          TEXT NOT NULL CHECK (status IN ('PENDING','SUCCESS','FAILED','REFUNDED','INCOMPLETE','EXPIRED')),
  work_order_id   TEXT REFERENCES work_orders(id) ON DELETE SET NULL,
  raw             JSONB,
  created_at      TIMESTAMPTZ NOT NULL,
  is_demo         BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS intent_executions (
  id                  TEXT PRIMARY KEY,
  quote_id            TEXT NOT NULL REFERENCES intent_quotes(id) ON DELETE CASCADE,
  work_order_id       TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  status              TEXT NOT NULL CHECK (status IN ('PENDING','SUCCESS','FAILED','REFUNDED','INCOMPLETE','EXPIRED')),
  destination_tx_hash TEXT,
  explorer_url        TEXT,
  updated_at          TIMESTAMPTZ NOT NULL,
  is_demo             BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS triage_suggestions (
  id                   TEXT PRIMARY KEY,
  report_id            TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  provider             TEXT NOT NULL,
  model                TEXT,
  available            BOOLEAN NOT NULL,
  confidence_bps       INTEGER CHECK (confidence_bps IS NULL OR confidence_bps BETWEEN 0 AND 10000),
  rationale            TEXT,
  duplicate_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  scope                TEXT,
  attestation_id       TEXT,
  unavailable_reason   TEXT,
  created_at           TIMESTAMPTZ NOT NULL,
  is_demo              BOOLEAN NOT NULL DEFAULT false
);

-- Explicit transaction intents. A row may only become SUCCESS after an adapter
-- returned a transaction hash; unsigned actions are never shown as executed.
CREATE TABLE IF NOT EXISTS chain_commands (
  id               TEXT PRIMARY KEY,
  work_order_id    TEXT REFERENCES work_orders(id) ON DELETE CASCADE,
  action           TEXT NOT NULL,
  method           TEXT NOT NULL,
  args             JSONB NOT NULL DEFAULT '{}'::jsonb,
  state            TEXT NOT NULL CHECK (state IN ('INTENT','PENDING','SUCCESS','FAILED')),
  mode             TEXT NOT NULL CHECK (mode IN ('LIVE_TESTNET','MAINNET','REPLAY')),
  adapter          TEXT NOT NULL,
  tx_hash          TEXT,
  error_code       TEXT,
  error_message    TEXT,
  real_transaction BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL,
  is_demo          BOOLEAN NOT NULL DEFAULT false,
  CHECK (state <> 'SUCCESS' OR tx_hash IS NOT NULL)
);

-- Append-only audit trail. UPDATE and DELETE are rejected by trigger below.
CREATE TABLE IF NOT EXISTS audit_events (
  seq           BIGSERIAL PRIMARY KEY,
  id            TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  actor         TEXT NOT NULL,
  work_order_id TEXT,
  asset_id      TEXT,
  at            TIMESTAMPTZ NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE OR REPLACE FUNCTION mend_reject_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_no_update_delete ON audit_events;
CREATE TRIGGER audit_events_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION mend_reject_audit_mutation();

DROP TRIGGER IF EXISTS audit_events_no_truncate ON audit_events;
CREATE TRIGGER audit_events_no_truncate
  BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION mend_reject_audit_mutation();

CREATE TABLE IF NOT EXISTS processed_events (
  event_key    TEXT PRIMARY KEY,
  source       TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS indexer_cursors (
  source     TEXT PRIMARY KEY,
  cursor     TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_is_demo ON assets (is_demo);
CREATE INDEX IF NOT EXISTS idx_reports_asset ON reports (asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status);
CREATE INDEX IF NOT EXISTS idx_reports_cluster ON reports (cluster_id);
CREATE INDEX IF NOT EXISTS idx_reports_is_demo ON reports (is_demo);
CREATE INDEX IF NOT EXISTS idx_clusters_status ON report_clusters (status);
CREATE INDEX IF NOT EXISTS idx_work_orders_asset ON work_orders (asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders (status);
CREATE INDEX IF NOT EXISTS idx_work_orders_contractor ON work_orders (contractor_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_is_demo ON work_orders (is_demo);
CREATE INDEX IF NOT EXISTS idx_bid_commitments_work_order ON bid_commitments (work_order_id);
CREATE INDEX IF NOT EXISTS idx_bid_reveals_work_order ON bid_reveals (work_order_id);
CREATE INDEX IF NOT EXISTS idx_scores_work_order ON score_executions (work_order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_work_order ON evidence_packages (work_order_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_objects_package ON evidence_objects (evidence_package_id);
CREATE INDEX IF NOT EXISTS idx_inspections_work_order ON inspections (work_order_id, signed_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_work_order ON payments (work_order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_warranty_work_order ON warranty_cases (work_order_id);
CREATE INDEX IF NOT EXISTS idx_attestations_subject ON attestations (subject_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intent_quotes_created ON intent_quotes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intent_executions_work_order ON intent_executions (work_order_id);
CREATE INDEX IF NOT EXISTS idx_triage_report ON triage_suggestions (report_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chain_commands_work_order ON chain_commands (work_order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chain_commands_state ON chain_commands (state);
CREATE INDEX IF NOT EXISTS idx_audit_work_order ON audit_events (work_order_id, at);
CREATE INDEX IF NOT EXISTS idx_audit_asset ON audit_events (asset_id, at);
CREATE INDEX IF NOT EXISTS idx_audit_name ON audit_events (name);
CREATE INDEX IF NOT EXISTS idx_processed_events_source ON processed_events (source);
