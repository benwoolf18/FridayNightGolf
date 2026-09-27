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
