import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/tournaments/123 — tournament, its two teams and their participants
export async function GET(request, { params }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid tournament" }, { status: 400 });

  try {
    const t = await sql`SELECT id, name, status, created_at FROM tournaments WHERE id = ${id}`;
    const tournament = t.rows[0];
    if (!tournament) return NextResponse.json({ error: "Tournament not found" }, { status: 404 });

    const tp = await sql`
      SELECT tt.team_label, tt.name AS team_name, p.id AS player_id, p.first_name, p.surname
      FROM tournament_teams tt
      LEFT JOIN tournament_team_players ttp ON ttp.team_id = tt.id
      LEFT JOIN players p ON p.id = ttp.player_id
      WHERE tt.tournament_id = ${id}
      ORDER BY tt.team_label, p.first_name`;

    const map = new Map();
    for (const r of tp.rows) {
      if (!map.has(r.team_label)) map.set(r.team_label, { label: r.team_label, name: r.team_name, players: [] });
      if (r.player_id) map.get(r.team_label).players.push({ id: r.player_id, first_name: r.first_name, surname: r.surname });
    }

    return NextResponse.json(
      { tournament, teams: [...map.values()] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("GET /api/tournaments/[id] failed:", err);
    return NextResponse.json({ error: "Could not load tournament" }, { status: 500 });
  }
}
