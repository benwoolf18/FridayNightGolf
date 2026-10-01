import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";
import { parseScoreBody, findOrCreateCourse } from "../../../lib/scores";

export const dynamic = "force-dynamic";

// GET /api/scores — every logged round with its players, newest first
export async function GET() {
  try {
    const { rows } = await sql`
      SELECT s.id,
             to_char(s.played_date, 'YYYY-MM-DD') AS date,
             s.course_name AS course,
             s.game_type AS "gameType",
             s.strokes,
             s.score_to_par AS score,
             s.holes_played AS "holesPlayed",
             COALESCE(json_agg(p.first_name ORDER BY p.first_name) FILTER (WHERE p.id IS NOT NULL), '[]'::json) AS players,
             COALESCE(json_agg(p.id ORDER BY p.first_name) FILTER (WHERE p.id IS NOT NULL), '[]'::json) AS "playerIds"
      FROM scores s
      LEFT JOIN score_players sp ON sp.score_id = s.id
      LEFT JOIN players p ON p.id = sp.player_id
      GROUP BY s.id
      ORDER BY s.played_date DESC, s.id DESC`;
    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/scores failed:", err);
    return NextResponse.json({ error: "Could not load results" }, { status: 500 });
  }
}

// POST /api/scores — log a score
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = parseScoreBody(body);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const v = parsed.value;

  try {
    const course = await findOrCreateCourse(v.courseName);

    const { rows } = await sql`
      INSERT INTO scores (played_date, course_id, course_name, game_type, strokes, score_to_par, holes_played, num_players)
      VALUES (${v.date}, ${course.id}, ${course.name}, ${v.gameType}, ${v.strokes}, ${v.scoreToPar}, ${v.holesPlayed}, ${v.numPlayers})
      RETURNING id`;
    const scoreId = rows[0].id;

    for (const playerId of v.playerIds) {
      await sql`INSERT INTO score_players (score_id, player_id) VALUES (${scoreId}, ${playerId})`;
    }

    return NextResponse.json({ id: scoreId }, { status: 201 });
  } catch (err) {
    console.error("POST /api/scores failed:", err);
    return NextResponse.json({ error: "Could not save score" }, { status: 500 });
  }
}
