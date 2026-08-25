ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamptz;
CREATE INDEX IF NOT EXISTS "players_last_seen_at_idx" ON "players" ("last_seen_at");
