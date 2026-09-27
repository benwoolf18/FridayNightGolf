import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const date = (body.date || "").trim();
  const courseName = (body.courseName || "").trim();
  const numPlayers = Number(body.numPlayers);
  const playerIds = Array.isArray(body.playerIds) ? body.playerIds.map(Number) : [];
  const strokesRaw = body.strokes;
  const scoreToParRaw = body.scoreToPar;

  if (!date) return NextResponse.json({ error: "Date is required" }, { status: 400 });
  if (!courseName) return NextResponse.json({ error: "Course is required" }, { status: 400 });
  if (!Number.isInteger(numPlayers) || numPlayers < 1 || numPlayers > 4) {
    return NextResponse.json({ error: "Number of players must be between 1 and 4" }, { status: 400 });
  }
  if (playerIds.length !== numPlayers || playerIds.some((id) => !Number.isInteger(id))) {
    return NextResponse.json(
      { error: `Select exactly ${numPlayers} player(s)` },
      { status: 400 }
    );
  }

  const strokes =
    strokesRaw !== undefined && strokesRaw !== null && String(strokesRaw).trim() !== ""
      ? Number(strokesRaw)
      : null;
  const scoreToPar =
    scoreToParRaw !== undefined && scoreToParRaw !== null && String(scoreToParRaw).trim() !== ""
      ? Number(scoreToParRaw)
      : null;

  if (strokes === null && scoreToPar === null) {
    return NextResponse.json(
      { error: "Enter either Number of Strokes or Score" },
      { status: 400 }
    );
  }
  if ((strokes !== null && Number.isNaN(strokes)) || (scoreToPar !== null && Number.isNaN(scoreToPar))) {
    return NextResponse.json({ error: "Score must be a number" }, { status: 400 });
  }

  try {
    // Find the course case-insensitively, or create it if this is the first time it's played
    const existing = await sql`SELECT id, name FROM courses WHERE name ILIKE ${courseName} LIMIT 1`;
    let courseId, storedCourseName;
    if (existing.rows.length) {
      courseId = existing.rows[0].id;
      storedCourseName = existing.rows[0].name;
    } else {
      const inserted = await sql`INSERT INTO courses (name) VALUES (${courseName}) RETURNING id, name`;
      courseId = inserted.rows[0].id;
      storedCourseName = inserted.rows[0].name;
    }

    const { rows } = await sql`
      INSERT INTO scores (played_date, course_id, course_name, strokes, score_to_par, num_players)
      VALUES (${date}, ${courseId}, ${storedCourseName}, ${strokes}, ${scoreToPar}, ${numPlayers})
      RETURNING id, played_date, course_name, strokes, score_to_par, num_players, created_at
    `;
    const score = rows[0];

    for (const playerId of playerIds) {
      await sql`INSERT INTO score_players (score_id, player_id) VALUES (${score.id}, ${playerId})`;
    }

    return NextResponse.json(score, { status: 201 });
  } catch (err) {
    console.error("POST /api/scores failed:", err);
    return NextResponse.json({ error: "Could not save score" }, { status: 500 });
  }
}
