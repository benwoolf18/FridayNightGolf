import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

// GET /api/courses/search?q=shri — returns courses whose name contains q
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  if (q.length < 3) {
    return NextResponse.json([]);
  }

  try {
    const { rows } = await sql`
      SELECT id, name
      FROM courses
      WHERE name ILIKE ${"%" + q + "%"}
      ORDER BY name ASC
      LIMIT 10
    `;
    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /api/courses/search failed:", err);
    return NextResponse.json({ error: "Could not search courses" }, { status: 500 });
  }
}
