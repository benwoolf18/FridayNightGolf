import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";
import { golfApi } from "../../../../lib/golfApi";

export const maxDuration = 60;

// POST /api/courses/import  { api_club_id }
export async function POST(request) {
  try {
    const { api_club_id } = await request.json();
    const club = await golfApi(`/clubs/${api_club_id}`);
    const clubName = club.name;
    const county = club.address?.county ?? null;
    const courses = club.courses ?? [];
    const saved = [];

    for (const c of courses) {
      const existing = await sql`
        SELECT id, name, scorecard_loaded FROM courses WHERE api_course_id = ${c.id}`;
      if (existing.rows[0]?.scorecard_loaded) {
        saved.push({ id: existing.rows[0].id, name: existing.rows[0].name });
        continue;
      }

      const teeSets = c.tee_sets ?? [];
      // Holes are fetched once per gender, then shared by that gender's tees
      const holesByGender = {};
      for (const t of teeSets) {
        const g = t.gender || "unknown";
        if (holesByGender[g]) continue;
        const sc = await golfApi(`/courses/${c.id}/scorecard?tee_id=${encodeURIComponent(t.id)}`);
        holesByGender[g] = sc.holes ?? [];
      }

      const displayName =
        courses.length === 1 || c.name === clubName ? clubName : `${clubName} – ${c.name}`;

      const ins = await sql`
        INSERT INTO courses (name, api_course_id, api_club_id, club_name, county, scorecard_loaded)
        VALUES (${displayName}, ${c.id}, ${api_club_id}, ${clubName}, ${county}, FALSE)
        ON CONFLICT (name) DO UPDATE SET
          api_course_id = EXCLUDED.api_course_id,
          api_club_id = EXCLUDED.api_club_id,
          club_name = EXCLUDED.club_name,
          county = EXCLUDED.county
        RETURNING id`;
      const courseId = ins.rows[0].id;

      // clear any half-finished earlier attempt
      await sql`DELETE FROM course_tee_sets WHERE course_id = ${courseId}`;

      for (const t of teeSets) {
        const tee = await sql`
          INSERT INTO course_tee_sets
            (course_id, name, gender, colour, par, slope_rating, course_rating, api_tee_id)
          VALUES
            (${courseId}, ${t.name}, ${t.gender ?? null}, ${t.colour ?? null}, ${t.par ?? null},
             ${t.slope_rating ?? null}, ${t.course_rating ?? null}, ${t.id})
          RETURNING id`;
        for (const h of holesByGender[t.gender || "unknown"] ?? []) {
          await sql`
            INSERT INTO course_holes (tee_set_id, hole_number, par, stroke_index)
            VALUES (${tee.rows[0].id}, ${h.hole_number}, ${h.par}, ${h.stroke_index ?? null})`;
        }
      }

      await sql`UPDATE courses SET scorecard_loaded = TRUE WHERE id = ${courseId}`;
      saved.push({ id: courseId, name: displayName });
    }
    return NextResponse.json({ courses: saved });
  } catch (err) {
    console.error("POST /api/courses/import failed:", err);
    const limited = String(err.message).includes("429");
    return NextResponse.json(
      { error: limited ? "Rate limit hit, wait a minute and try again" : "Could not import course" },
      { status: limited ? 429 : 500 }
    );
  }
}