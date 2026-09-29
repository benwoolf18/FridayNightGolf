-- Run this once in your Vercel Postgres "Query" tab to set up the players table.
-- Safe to re-run: IF NOT EXISTS means it won't error or wipe data if it already exists.

CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  surname TEXT,
  handicap NUMERIC NOT NULL,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Self-maintained course list (built up as rounds get logged, rather than
-- relying on a third-party dataset that turned out to be US-only)
CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scores (
  id SERIAL PRIMARY KEY,
  played_date DATE NOT NULL,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  course_name TEXT NOT NULL,
  strokes INTEGER,
  score_to_par INTEGER,
  num_players INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which players were in a given round
CREATE TABLE IF NOT EXISTS score_players (
  score_id INTEGER NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (score_id, player_id)
);

-- Rounds started from the "Start a round" popup
CREATE TABLE IF NOT EXISTS rounds (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  course_name TEXT NOT NULL,
  game_type TEXT NOT NULL,
  num_teams INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS round_teams (
  id SERIAL PRIMARY KEY,
  round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  team_number INTEGER NOT NULL,
  UNIQUE (round_id, team_number)
);

-- A player can only be on one team in a given round
CREATE TABLE IF NOT EXISTS round_team_players (
  round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES round_teams(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (round_id, player_id)
);
