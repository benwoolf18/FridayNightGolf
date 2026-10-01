import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

const GAME_TYPES = ["Fourball", "Gruesomes", "Foursomes", "Texas Scramble", "Singles", "Stroke Play"];

// POST /api/rounds/start  { courseName, courseId?, teeSetId?, gameType, teams: [[playerId,...],...] }
export async function POST(request) {
  let roundId = null;
  try {
    const body = await request.json();
    const courseNameIn = String(body.courseName || "").trim();
    const gameType = body.gameType;
    const teams = Array.isArray(body.teams) ? body.teams : [];
    const teeSetIn = body.teeSetId ? Number(body.teeSetId) : null;

    if (!courseNameIn) return NextResponse.json({ error: "Course is required" }, { status: 400 });
    if (!GAME_TYPES.includes(gameType)) return NextResponse.json({ error: "Game type is required" }, { status: 400 });
    if (teams.length < 1 || teams.some((t) => !Array.isArray(t) || t.length === 0)) {
      return NextResponse.json({ error: "Every team needs at least one player" }, { status: 400 });
    }
    const playerIds = teams.flat().map(Number);
    if (playerIds.some((n) => !Number.isInteger(n)) || new Set(playerIds).size !== playerIds.length) {
      return NextResponse.json({ error: "Invalid players" }, { status: 400 });
    }

    // --- course: use the picked one, else find by name, else create (hand-typed course) ---
    let course = null;
    if (body.courseId && Number.isInteger(Number(body.courseId))) {
      const r = await sql`SELECT id, name FROM courses WHERE id = ${Number(body.courseId)}`;
      course = r.rows[0] || null;
    }
    if (!course) {
      const r = await sql`SELECT id, name FROM courses WHERE lower(name) = lower(${courseNameIn}) LIMIT 1`;
      course = r.rows[0] || null;
    }
    if (!course) {
      const r = await sql`
        INSERT INTO courses (name) VALUES (${courseNameIn})
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id, name`;
      course = r.rows[0];
    }

    // --- tee must belong to the course ---
    let teeSetId = null;
    if (teeSetIn) {
      const r = await sql`SELECT id FROM course_tee_sets WHERE id = ${teeSetIn} AND course_id = ${course.id}`;
      teeSetId = r.rows[0]?.id ?? null;
    }

    // --- title: "Date – Course – Match type", with (2), (3)... for repeats ---
    const todayLondon = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }); // YYYY-MM-DD
    const playedDate = String(body.date || "").trim() || todayLondon;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(playedDate)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    const prettyDate = new Date(`${playedDate}T12:00:00Z`).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
    });
    const base = `${prettyDate} – ${course.name} – ${gameType}`;
    const like = base.replace(/[\\%_]/g, (m) => "\\" + m) + " (%";
    const existing = await sql`SELECT title FROM rounds WHERE title = ${base} OR title LIKE ${like}`;
    let highest = 0;
    for (const { title } of existing.rows) {
      if (title === base) highest = Math.max(highest, 1);
      else {
        const m = title.startsWith(base) && title.slice(base.length).match(/^ \((\d+)\)$/);
        if (m) highest = Math.max(highest, Number(m[1]));
      }
    }
    const title = highest === 0 ? base : `${base} (${highest + 1})`;

    // --- create the round, teams and players ---
    const r = await sql`
      INSERT INTO rounds (course_id, course_name, game_type, num_teams, status, tee_set_id, title, played_date)
      VALUES (${course.id}, ${course.name}, ${gameType}, ${teams.length}, 'in_progress', ${teeSetId}, ${title}, ${playedDate})
      RETURNING id`;
    roundId = r.rows[0].id;

    for (let i = 0; i < teams.length; i++) {
      const t = await sql`
        INSERT INTO round_teams (round_id, team_number) VALUES (${roundId}, ${i + 1}) RETURNING id`;
      for (const pid of teams[i].map(Number)) {
        await sql`
          INSERT INTO round_team_players (round_id, team_id, player_id)
          VALUES (${roundId}, ${t.rows[0].id}, ${pid})`;
      }
    }

    return NextResponse.json({ id: roundId, title });
  } catch (err) {
    console.error("POST /api/rounds/start failed:", err);
    if (roundId) {
      try { await sql`DELETE FROM rounds WHERE id = ${roundId}`; } catch {}
    }
    return NextResponse.json({ error: "Could not start round" }, { status: 500 });
  }
}
