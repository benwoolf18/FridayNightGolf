import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";
import { golfApi } from "../../../../lib/golfApi";

// POST /api/courses/import  { api_club_id } — stores the club's courses, tees and holes
export async function POST(request) {
  try {
    const { api_club_id } = await request.json();
    const club = await golfApi(`/clubs/${api_club_id}`);
    const courses = club.courses ?? [];
    const saved = [];

    for (const c of courses) {
      const existing = await sql`
        SELECT id, scorecard_loaded FROM courses WHERE api_course_id = ${c.id}`;
      if (existing.rows[0]?.scorecard_loaded) {
        saved.push({ id: existing.rows[0].id, name: c.name });
        continue;
      }

      const sc = await golfApi(`/courses/${c.id}/scorecard`);
      const displayName =
        courses.length === 1 || c.name === club.name ? club.name : `${club.name} – ${c.name}`;

      const ins = await sql`
        INSERT INTO courses (name, api_course_id, api_club_id, club_name, county, scorecard_loaded)
        VALUES (${displayName}, ${c.id}, ${api_club_id}, ${club.name}, ${club.county}, TRUE)
        ON CONFLICT (api_course_id) DO UPDATE SET scorecard_loaded = TRUE
        RETURNING id`;
      const courseId = ins.rows[0].id;

      for (const t of sc.tee_sets ?? []) {
        const tee = await sql`
          INSERT INTO course_tee_sets (course_id, name, gender, par, slope_rating, course_rating)
          VALUES (${courseId}, ${t.name}, ${t.gender}, ${t.par}, ${t.slope_rating}, ${t.course_rating})
          RETURNING id`;
        for (const h of t.holes ?? []) {
          await sql`
            INSERT INTO course_holes (tee_set_id, hole_number, par, stroke_index)
            VALUES (${tee.rows[0].id}, ${h.hole_number}, ${h.par}, ${h.stroke_index})`;
        }
      }
      saved.push({ id: courseId, name: displayName });
    }
    return NextResponse.json({ courses: saved });
  } catch (err) {
    console.error("POST /api/courses/import failed:", err);
    return NextResponse.json({ error: "Could not import course" }, { status: 500 });
  }
}