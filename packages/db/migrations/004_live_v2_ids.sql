-- Real testnet V2 identifiers carry a version segment:
--   asset   BENCH-V2-001
--   cluster CL-V2-0001
-- The original read-model checks only allowed the shorter replay IDs
-- (BENCH-001 / CL-0001). Widen both checks while keeping the same shape and
-- rejecting arbitrary text. Existing canonical IDs remain valid.
--
-- This migration does not change chain state or the hub contract. It only lets
-- the Postgres read model store the identifiers that were actually recorded on
-- NEAR testnet.

ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_id_check;
ALTER TABLE assets ADD CONSTRAINT assets_id_check
  CHECK (id ~ '^[A-Z]{2,12}(-[A-Z0-9]{1,8})?-[0-9]{3}$');

ALTER TABLE report_clusters DROP CONSTRAINT IF EXISTS report_clusters_id_check;
ALTER TABLE report_clusters ADD CONSTRAINT report_clusters_id_check
  CHECK (id ~ '^CL(-[A-Z0-9]{1,8})?-[0-9]{4}$');
