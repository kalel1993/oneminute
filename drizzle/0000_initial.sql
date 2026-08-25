CREATE TABLE players (id text PRIMARY KEY, display_name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE game_sessions (id text PRIMARY KEY, player_id text NOT NULL REFERENCES players(id), mode text NOT NULL CHECK(mode IN ('touch','mouse')), seed integer NOT NULL, started_at timestamptz NOT NULL, finished_at timestamptz, score integer, valid boolean NOT NULL DEFAULT false, suspicious boolean NOT NULL DEFAULT false, trace jsonb);
CREATE INDEX sessions_player_time ON game_sessions(player_id,started_at);
CREATE INDEX ranked_sessions ON game_sessions(mode,score DESC) WHERE valid=true;
CREATE TABLE challenges (id text PRIMARY KEY, creator_id text NOT NULL REFERENCES players(id), session_id text NOT NULL REFERENCES game_sessions(id), parent_id text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE activity_events (id text PRIMARY KEY, player_id text NOT NULL REFERENCES players(id), kind text NOT NULL, score integer, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE submissions (session_id text PRIMARY KEY REFERENCES game_sessions(id), fingerprint text NOT NULL);
