ALTER TABLE players ADD COLUMN clerk_user_id text;
ALTER TABLE players ADD COLUMN credits integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX players_clerk_user_id_unique ON players(clerk_user_id) WHERE clerk_user_id IS NOT NULL;

CREATE TABLE credit_purchases (
  stripe_session_id text PRIMARY KEY,
  player_id text NOT NULL REFERENCES players(id),
  credits integer NOT NULL CHECK (credits > 0),
  amount integer NOT NULL CHECK (amount > 0),
  currency text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_purchases_player_time ON credit_purchases(player_id, created_at);
