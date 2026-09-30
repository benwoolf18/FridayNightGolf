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
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS api_course_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS api_club_id TEXT,
  ADD COLUMN IF NOT EXISTS club_name TEXT,
  ADD COLUMN IF NOT EXISTS county TEXT,
  ADD COLUMN IF NOT EXISTS scorecard_loaded BOOLEAN DEFAULT FALSE;

  CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  api_course_id TEXT UNIQUE NOT NULL,
  api_club_id TEXT,
  club_name TEXT NOT NULL,
  course_name TEXT NOT NULL,
  county TEXT,
  scorecard_loaded BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS course_tee_sets (
  id SERIAL PRIMARY KEY,
  course_id INT REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gender TEXT,
  par INT,
  slope_rating INT,
  course_rating NUMERIC(4,1)
);

CREATE TABLE IF NOT EXISTS course_holes (
  id SERIAL PRIMARY KEY,
  tee_set_id INT REFERENCES course_tee_sets(id) ON DELETE CASCADE,
  hole_number INT NOT NULL,
  par INT NOT NULL,
  stroke_index INT
);

CREATE TABLE IF NOT EXISTS api_usage (
  month TEXT PRIMARY KEY,
  calls INT DEFAULT 0
);