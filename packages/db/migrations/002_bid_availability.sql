-- Forward migration for databases that already applied 001_init.sql before
-- bid availability became part of the canonical bid commitment/reveal.
ALTER TABLE bid_reveals
  ADD COLUMN IF NOT EXISTS available_in_days INTEGER NOT NULL DEFAULT 0
  CHECK (available_in_days BETWEEN 0 AND 365);
