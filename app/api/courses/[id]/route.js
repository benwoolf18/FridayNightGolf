import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

// GET /api/courses/123 — cached tee sets with holes; no external calls
export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const tees = await sql`
      SELECT id, name, gender, par, slope_rating, course_rating
      FROM course_tee_sets WHERE course_id = ${id} ORDER BY name`;
    const holes = await sql`
      SELECT h.tee_set_id, h.hole_number, h.par, h.stroke_index
      FROM course_holes h JOIN course_tee_sets t ON t.id = h.tee_set_id
      WHERE t.course_id = ${id} ORDER BY h.hole_number`;

    const tee_sets = tees.rows.map((t) => ({
      ...t,
      holes: holes.rows.filter((h) => h.tee_set_id === t.id),
    }));
    return NextResponse.json({ tee_sets });
  } catch (err) {
    console.error("GET /api/courses/[id] failed:", err);
    return NextResponse.json({ error: "Could not load course" }, { status: 500 });
  }
}