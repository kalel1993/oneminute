ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "daily_play_date" date,
  ADD COLUMN IF NOT EXISTS "daily_plays" integer DEFAULT 0 NOT NULL;

UPDATE "players" AS p
SET
  "daily_play_date" = CURRENT_DATE,
  "daily_plays" = LEAST(3, (
    SELECT count(*)::integer
    FROM "game_sessions" AS s
    WHERE s."player_id" = p."id"
      AND s."started_at" >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
  ))
WHERE EXISTS (
  SELECT 1
  FROM "game_sessions" AS s
  WHERE s."player_id" = p."id"
    AND s."started_at" >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
);

CREATE TABLE IF NOT EXISTS "rate_limit_buckets" (
  "key" text PRIMARY KEY NOT NULL,
  "window_start" timestamp with time zone NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "rate_limit_buckets_updated_at"
  ON "rate_limit_buckets" ("updated_at");

