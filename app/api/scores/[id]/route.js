import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";
import { parseScoreBody, findOrCreateCourse } from "../../../../lib/scores";

export const dynamic = "force-dynamic";

// PUT /api/scores/123 — edit a logged score (same fields as logging one)
export async function PUT(request, { params }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid score" }, { status: 400 });

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
    const existing = await sql`SELECT id FROM scores WHERE id = ${id}`;
    if (!existing.rows.length) return NextResponse.json({ error: "Score not found" }, { status: 404 });

    const course = await findOrCreateCourse(v.courseName);

    await sql`
      UPDATE scores
      SET played_date = ${v.date}, course_id = ${course.id}, course_name = ${course.name},
          game_type = ${v.gameType}, strokes = ${v.strokes}, score_to_par = ${v.scoreToPar},
          holes_played = ${v.holesPlayed}, num_players = ${v.numPlayers}
      WHERE id = ${id}`;

    await sql`DELETE FROM score_players WHERE score_id = ${id}`;
    for (const playerId of v.playerIds) {
      await sql`INSERT INTO score_players (score_id, player_id) VALUES (${id}, ${playerId})`;
    }

    return NextResponse.json({ id });
  } catch (err) {
    console.error("PUT /api/scores/[id] failed:", err);
    return NextResponse.json({ error: "Could not update score" }, { status: 500 });
  }
}
