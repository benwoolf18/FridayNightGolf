import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/rounds/123 — round, tee, holes, teams/players and scores so far
export async function GET(request, { params }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid round" }, { status: 400 });

  try {
    const r = await sql`
      SELECT id, title, course_id, course_name, game_type, status, played_date, tee_set_id
      FROM rounds WHERE id = ${id}`;
    const round = r.rows[0];
    if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });
    round.title = round.title || `${round.course_name} – ${round.game_type}`;

    let tee = null;
    let holes = [];
    if (round.tee_set_id) {
      const t = await sql`
        SELECT id, name, gender, par, slope_rating, course_rating
        FROM course_tee_sets WHERE id = ${round.tee_set_id}`;
      tee = t.rows[0] || null;
      const h = await sql`
        SELECT hole_number, par, stroke_index
        FROM course_holes WHERE tee_set_id = ${round.tee_set_id} ORDER BY hole_number`;
      holes = h.rows;
    }

    const tp = await sql`
      SELECT t.team_number, p.id AS player_id, p.first_name, p.surname
      FROM round_teams t
      LEFT JOIN round_team_players rtp ON rtp.team_id = t.id
      LEFT JOIN players p ON p.id = rtp.player_id
      WHERE t.round_id = ${id}
      ORDER BY t.team_number, p.first_name`;
    const teamMap = new Map();
    for (const row of tp.rows) {
      if (!teamMap.has(row.team_number)) teamMap.set(row.team_number, { team_number: row.team_number, players: [] });
      if (row.player_id) {
        teamMap.get(row.team_number).players.push({
          id: row.player_id, first_name: row.first_name, surname: row.surname,
        });
      }
    }

    const sc = await sql`
      SELECT player_id, hole_number, strokes FROM round_scores WHERE round_id = ${id}`;

    return NextResponse.json(
      { round, tee, holes, teams: [...teamMap.values()], scores: sc.rows },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/rounds/[id] failed:", err);
    return NextResponse.json({ error: "Could not load round" }, { status: 500 });
  }
}

// PATCH /api/rounds/123
//   { action: "score", playerId, hole, strokes }   (strokes null clears the score)
//   { action: "end" }
export async function PATCH(request, { params }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid round" }, { status: 400 });

  try {
    const body = await request.json();
    const r = await sql`SELECT status FROM rounds WHERE id = ${id}`;
    if (!r.rows[0]) return NextResponse.json({ error: "Round not found" }, { status: 404 });
    if (r.rows[0].status !== "in_progress") {
      return NextResponse.json({ error: "This round has ended" }, { status: 409 });
    }

    if (body.action === "end") {
      await sql`UPDATE rounds SET status = 'completed', ended_at = now() WHERE id = ${id}`;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "score") {
      const playerId = Number(body.playerId);
      const hole = Number(body.hole);
      const strokes = body.strokes === null ? null : Number(body.strokes);
      if (!Number.isInteger(playerId) || !Number.isInteger(hole) || hole < 1 || hole > 18) {
        return NextResponse.json({ error: "Invalid score" }, { status: 400 });
      }
      if (strokes !== null && (!Number.isInteger(strokes) || strokes < 1 || strokes > 20)) {
        return NextResponse.json({ error: "Strokes must be between 1 and 20" }, { status: 400 });
      }
      const inRound = await sql`
        SELECT 1 FROM round_team_players WHERE round_id = ${id} AND player_id = ${playerId}`;
      if (inRound.rows.length === 0) {
        return NextResponse.json({ error: "Player is not in this round" }, { status: 400 });
      }
      if (strokes === null) {
        await sql`DELETE FROM round_scores WHERE round_id = ${id} AND player_id = ${playerId} AND hole_number = ${hole}`;
      } else {
        await sql`
          INSERT INTO round_scores (round_id, player_id, hole_number, strokes)
          VALUES (${id}, ${playerId}, ${hole}, ${strokes})
          ON CONFLICT (round_id, player_id, hole_number)
          DO UPDATE SET strokes = EXCLUDED.strokes, updated_at = now()`;
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("PATCH /api/rounds/[id] failed:", err);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
