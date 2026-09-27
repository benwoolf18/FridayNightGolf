import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

// GET /api/players — list all players (used later by "Edit Existing Player")
export async function GET() {
  try {
    const { rows } = await sql`
      SELECT id, first_name, surname, handicap, photo_url, created_at
      FROM players
      ORDER BY first_name ASC
    `;
    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /api/players failed:", err);
    return NextResponse.json({ error: "Could not load players" }, { status: 500 });
  }
}

// POST /api/players — create a new player
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const firstName = (body.firstName || "").trim();
  const surname = (body.surname || "").trim();
  const handicap = body.handicap;
  const photo = body.photo || null;

  if (!firstName) {
    return NextResponse.json({ error: "First name is required" }, { status: 400 });
  }
  if (handicap === undefined || handicap === null || String(handicap).trim() === "") {
    return NextResponse.json({ error: "Handicap is required" }, { status: 400 });
  }
  const handicapNum = Number(handicap);
  if (Number.isNaN(handicapNum)) {
    return NextResponse.json({ error: "Handicap must be a number" }, { status: 400 });
  }

  try {
    const { rows } = await sql`
      INSERT INTO players (first_name, surname, handicap, photo_url)
      VALUES (${firstName}, ${surname || null}, ${handicapNum}, ${photo})
      RETURNING id, first_name, surname, handicap, photo_url, created_at
    `;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("POST /api/players failed:", err);
    return NextResponse.json({ error: "Could not save player" }, { status: 500 });
  }
}
