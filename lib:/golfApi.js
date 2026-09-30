import { sql } from "@vercel/postgres";

const BASE = "https://uk-golf-api.vercel.app";
const MONTHLY_CAP = 190; // stop a little short of the 200 free-tier limit

export async function golfApi(path) {
  const month = new Date().toISOString().slice(0, 7);
  const { rows } = await sql`
    INSERT INTO api_usage (month, calls) VALUES (${month}, 1)
    ON CONFLICT (month) DO UPDATE SET calls = api_usage.calls + 1
    RETURNING calls`;
  if (rows[0].calls > MONTHLY_CAP) throw new Error("API monthly cap reached");

  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
      "X-RapidAPI-Host": "uk-golf-course-data-api.p.rapidapi.com",
    },
  });
  if (!res.ok) throw new Error(`Golf API ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}