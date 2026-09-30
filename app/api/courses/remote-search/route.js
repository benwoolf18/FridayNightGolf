import { NextResponse } from "next/server";
import { golfApi } from "../../../../lib/golfApi";

// GET /api/courses/remote-search?q=shrivenham — spends 1 API request
export async function GET(request) {
  const q = (new URL(request.url).searchParams.get("q") || "").trim();
  if (q.length < 3) return NextResponse.json([]);

  try {
    const data = await golfApi(`/clubs?search=${encodeURIComponent(q)}`);
    const list = Array.isArray(data) ? data : data.items ?? [];
    return NextResponse.json(
      list.slice(0, 10).map((c) => ({ api_club_id: c.id, name: c.name, county: c.county }))
    );
  } catch (err) {
    console.error("GET /api/courses/remote-search failed:", err);
    return NextResponse.json({ error: "Could not search UK courses" }, { status: 500 });
  }
}