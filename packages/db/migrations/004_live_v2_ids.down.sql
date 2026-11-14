-- Manual local-only teardown for 004_live_v2_ids.sql. Never used by deploy
-- tooling; real testnet rows using versioned IDs must be removed first.
ALTER TABLE report_clusters DROP CONSTRAINT IF EXISTS report_clusters_id_check;
ALTER TABLE report_clusters ADD CONSTRAINT report_clusters_id_check
  CHECK (id ~ '^CL-[0-9]{4}$');

ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_id_check;
ALTER TABLE assets ADD CONSTRAINT assets_id_check
  CHECK (id ~ '^[A-Z]{2,12}-[0-9]{3}$');
