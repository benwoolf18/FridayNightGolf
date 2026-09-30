import { NextResponse } from "next/server";
import { golfApi } from "../../../../lib/golfApi";

// GET /api/courses/remote-search?q=sunningdale — spends 1 API request
export async function GET(request) {
  const q = (new URL(request.url).searchParams.get("q") || "").trim();
  if (q.length < 3) return NextResponse.json([]);

  try {
    const data = await golfApi(`/clubs?search=${encodeURIComponent(q)}&per_page=10`);
    const list = Array.isArray(data) ? data : data.clubs ?? [];
    return NextResponse.json(
      list.map((c) => ({
        api_club_id: c.id,
        name: c.name,
        county: c.county ?? c.address?.county ?? null,
      }))
    );
  } catch (err) {
    console.error("GET /api/courses/remote-search failed:", err);
    return NextResponse.json({ error: "Could not search UK courses" }, { status: 500 });
  }
}