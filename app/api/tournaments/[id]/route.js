import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/tournaments  { name, teams: [{ name, players: [id,...] }, { name, players: [...] }] }
export async function POST(request) {
  let tournamentId = null;
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const teams = Array.isArray(body.teams) ? body.teams : [];

    if (!name) return NextResponse.json({ error: "Tournament name is required" }, { status: 400 });
    if (teams.length !== 2) return NextResponse.json({ error: "A tournament needs two teams" }, { status: 400 });

    const cleaned = teams.map((t) => ({
      name: String(t?.name || "").trim(),
      players: Array.isArray(t?.players) ? t.players.map(Number) : [],
    }));
    if (cleaned.some((t) => !t.name)) {
      return NextResponse.json({ error: "Both teams need a name" }, { status: 400 });
    }
    if (cleaned[0].name.toLowerCase() === cleaned[1].name.toLowerCase()) {
      return NextResponse.json({ error: "Team names must be different" }, { status: 400 });
    }
    if (cleaned.some((t) => t.players.length === 0)) {
      return NextResponse.json({ error: "Each team needs at least one participant" }, { status: 400 });
    }
    const all = cleaned.flatMap((t) => t.players);
    if (all.some((n) => !Number.isInteger(n)) || new Set(all).size !== all.length) {
      return NextResponse.json({ error: "Invalid participants" }, { status: 400 });
    }

    const r = await sql`INSERT INTO tournaments (name) VALUES (${name}) RETURNING id`;
    tournamentId = r.rows[0].id;

    const labels = ["A", "B"];
    for (let i = 0; i < 2; i++) {
      const t = await sql`
        INSERT INTO tournament_teams (tournament_id, team_label, name)
        VALUES (${tournamentId}, ${labels[i]}, ${cleaned[i].name}) RETURNING id`;
      for (const pid of cleaned[i].players) {
        await sql`
          INSERT INTO tournament_team_players (tournament_id, team_id, player_id)
          VALUES (${tournamentId}, ${t.rows[0].id}, ${pid})`;
      }
    }

    return NextResponse.json({ id: tournamentId, name });
  } catch (err) {
    console.error("POST /api/tournaments failed:", err);
    if (tournamentId) {
      try { await sql`DELETE FROM tournaments WHERE id = ${tournamentId}`; } catch {}
    }
    return NextResponse.json({ error: "Could not start tournament" }, { status: 500 });
  }
}
