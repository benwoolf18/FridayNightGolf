import { sql } from "@vercel/postgres";

export const GAME_TYPES = ["Fourball", "Gruesomes", "Foursomes", "Texas Scramble", "Singles", "Stroke Play"];

const blank = (v) => v === undefined || v === null || String(v).trim() === "";

// Validates the body shared by "log a score" (POST) and "edit a score" (PUT).
// Returns { error } or { value }.
export function parseScoreBody(body) {
  const date = String(body?.date || "").trim();
  const courseName = String(body?.courseName || "").trim();
  const gameType = body?.gameType;
  const numPlayers = Number(body?.numPlayers);
  const playerIds = Array.isArray(body?.playerIds) ? body.playerIds.map(Number) : [];

  if (!date) return { error: "Date is required" };
  if (!courseName) return { error: "Course is required" };
  if (!GAME_TYPES.includes(gameType)) return { error: "Game type is required" };
  if (!Number.isInteger(numPlayers) || numPlayers < 1 || numPlayers > 4) {
    return { error: "Number of players must be between 1 and 4" };
  }
  if (playerIds.length !== numPlayers || playerIds.some((id) => !Number.isInteger(id)) || new Set(playerIds).size !== playerIds.length) {
    return { error: `Select exactly ${numPlayers} player(s)` };
  }

  const strokes = blank(body?.strokes) ? null : Number(body.strokes);
  const scoreText = String(body?.scoreToPar ?? "").trim();
  const scoreToPar = scoreText === "" ? null : /^(e|even)$/i.test(scoreText) ? 0 : Number(scoreText);
  if (strokes === null && scoreToPar === null) return { error: "Enter either Number of Strokes or Score" };
  if ((strokes !== null && Number.isNaN(strokes)) || (scoreToPar !== null && Number.isNaN(scoreToPar))) {
    return { error: "Score must be a number" };
  }

  // null = a full 18; otherwise the number of holes actually played
  let holesPlayed = null;
  if (!blank(body?.holesPlayed)) {
    holesPlayed = Number(body.holesPlayed);
    if (!Number.isInteger(holesPlayed) || holesPlayed < 1 || holesPlayed > 17) {
      return { error: "Holes played must be a whole number from 1 to 17" };
    }
  }

  return { value: { date, courseName, gameType, numPlayers, playerIds, strokes, scoreToPar, holesPlayed } };
}

// Find the course case-insensitively, or create it the first time it's played
export async function findOrCreateCourse(courseName) {
  const existing = await sql`SELECT id, name FROM courses WHERE name ILIKE ${courseName} LIMIT 1`;
  if (existing.rows.length) return existing.rows[0];
  const inserted = await sql`INSERT INTO courses (name) VALUES (${courseName}) RETURNING id, name`;
  return inserted.rows[0];
}
