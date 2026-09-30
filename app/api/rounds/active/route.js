import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/rounds/active — rounds still in progress, newest first
export async function GET() {
  try {
    const { rows } = await sql`
      SELECT id, title, course_name, game_type, played_date, created_at
      FROM rounds
      WHERE status = 'in_progress'
      ORDER BY played_date DESC NULLS LAST, created_at DESC`;
    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        title: r.title || `${r.course_name} – ${r.game_type}`,
        played_date: r.played_date,
      }))
    );
  } catch (err) {
    console.error("GET /api/rounds/active failed:", err);
    return NextResponse.json({ error: "Could not load rounds" }, { status: 500 });
  }
}
