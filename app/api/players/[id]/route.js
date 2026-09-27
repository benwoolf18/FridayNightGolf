import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

// PUT /api/players/:id — update an existing player, overwriting stored data
export async function PUT(request, { params }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid player id" }, { status: 400 });
  }

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
      UPDATE players
      SET first_name = ${firstName}, surname = ${surname || null}, handicap = ${handicapNum}, photo_url = ${photo}
      WHERE id = ${id}
      RETURNING id, first_name, surname, handicap, photo_url, created_at
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error("PUT /api/players/[id] failed:", err);
    return NextResponse.json({ error: "Could not save player" }, { status: 500 });
  }
}
