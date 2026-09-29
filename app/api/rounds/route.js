import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

const GAME_TYPES = ["Fourball", "Gruesomes", "Foursomes", "Texas Scramble", "Singles"];

// POST /api/rounds — start a round: course, game type and teams (arrays of player ids)
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const courseName = (body.courseName || "").trim();
  const gameType = body.gameType;
  const teams = Array.isArray(body.teams)
    ? body.teams.map((t) => (Array.isArray(t) ? t.map(Number) : []))
    : [];

  if (!courseName) return NextResponse.json({ error: "Course is required" }, { status: 400 });
  if (!GAME_TYPES.includes(gameType)) {
    return NextResponse.json({ error: "Game type is required" }, { status: 400 });
  }
  if (teams.length < 2 || teams.length > 4) {
    return NextResponse.json({ error: "A round needs between 2 and 4 teams" }, { status: 400 });
  }
  if (teams.some((t) => t.length === 0 || t.some((id) => !Number.isInteger(id)))) {
    return NextResponse.json({ error: "Every team needs at least one player" }, { status: 400 });
  }
  const allIds = teams.flat();
  if (new Set(allIds).size !== allIds.length) {
    return NextResponse.json({ error: "A player can only be on one team" }, { status: 400 });
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
      INSERT INTO rounds (course_id, course_name, game_type, num_teams)
      VALUES (${courseId}, ${storedCourseName}, ${gameType}, ${teams.length})
      RETURNING id, course_name, game_type, num_teams, status, created_at
    `;
    const round = rows[0];

    for (let i = 0; i < teams.length; i++) {
      const teamRow = await sql`
        INSERT INTO round_teams (round_id, team_number)
        VALUES (${round.id}, ${i + 1})
        RETURNING id
      `;
      const teamId = teamRow.rows[0].id;
      for (const playerId of teams[i]) {
        await sql`
          INSERT INTO round_team_players (round_id, team_id, player_id)
          VALUES (${round.id}, ${teamId}, ${playerId})
        `;
      }
    }

    return NextResponse.json(round, { status: 201 });
  } catch (err) {
    console.error("POST /api/rounds failed:", err);
    return NextResponse.json({ error: "Could not start round" }, { status: 500 });
  }
}
