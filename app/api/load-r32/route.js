import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/* ============================================================================
   ONE-TIME R32 BRACKET LOADER  (/api/load-r32)
   Adds the 16 official Round-of-32 matchups to EVERY group's koGames so the
   scoring engine recognizes which teams advanced (out-of-group + R32-win
   bonuses), and writes the games already finished into the shared results row.

   Safe + idempotent:
   - Only ADDS koGames that aren't already present (matched by id). Never
     removes or rewrites existing games or group-stage data.
   - Only fills shared results for finished games that are currently BLANK,
     so it never overwrites a score you entered by hand.
   - Skips the reserved __results__ row when adding koGames.

   Guard with ?key=SYNC_SECRET (same secret as the sync route).
============================================================================ */

const RESULTS_ID = "__results__";

// The 16 R32 matchups, ET dates/times. Stage "r32" so the engine scores them.
const R32_FIXTURES = [
  { id: "r32-1",  stage: "r32", home: "South Africa", away: "Canada",   date: "2026-06-28", day: "Sun", time: "3:00 PM" },
  { id: "r32-2",  stage: "r32", home: "Brazil",       away: "Japan",    date: "2026-06-29", day: "Mon", time: "1:00 PM" },
  { id: "r32-3",  stage: "r32", home: "Germany",      away: "Paraguay", date: "2026-06-29", day: "Mon", time: "4:30 PM" },
  { id: "r32-4",  stage: "r32", home: "Netherlands",  away: "Morocco",  date: "2026-06-29", day: "Mon", time: "9:00 PM" },
  { id: "r32-5",  stage: "r32", home: "Ivory Coast",  away: "Norway",   date: "2026-06-30", day: "Tue", time: "1:00 PM" },
  { id: "r32-6",  stage: "r32", home: "France",       away: "Sweden",   date: "2026-06-30", day: "Tue", time: "5:00 PM" },
  { id: "r32-7",  stage: "r32", home: "Mexico",       away: "Ecuador",  date: "2026-06-30", day: "Tue", time: "9:00 PM" },
  { id: "r32-8",  stage: "r32", home: "England",      away: "DR Congo", date: "2026-07-01", day: "Wed", time: "12:00 PM" },
  { id: "r32-9",  stage: "r32", home: "Belgium",      away: "Senegal",  date: "2026-07-01", day: "Wed", time: "4:00 PM" },
  { id: "r32-10", stage: "r32", home: "United States",away: "Bosnia and Herzegovina", date: "2026-07-01", day: "Wed", time: "8:00 PM" },
  { id: "r32-11", stage: "r32", home: "Spain",        away: "Austria",  date: "2026-07-02", day: "Thu", time: "3:00 PM" },
  { id: "r32-12", stage: "r32", home: "Portugal",     away: "Croatia",  date: "2026-07-02", day: "Thu", time: "7:00 PM" },
  { id: "r32-13", stage: "r32", home: "Switzerland",  away: "Algeria",  date: "2026-07-02", day: "Thu", time: "11:00 PM" },
  { id: "r32-14", stage: "r32", home: "Australia",    away: "Egypt",    date: "2026-07-03", day: "Fri", time: "2:00 PM" },
  { id: "r32-15", stage: "r32", home: "Argentina",    away: "Cape Verde", date: "2026-07-03", day: "Fri", time: "6:00 PM" },
  { id: "r32-16", stage: "r32", home: "Colombia",     away: "Ghana",    date: "2026-07-03", day: "Fri", time: "9:30 PM" },
];

// R32 games already completed. {h,a} are the real on-field goals in the listed
// home/away orientation; w is the advancing team. pen:true = decided on pens.
const R32_RESULTS = {
  "r32-1": { h: 0, a: 1, w: "Canada" },
  "r32-2": { h: 2, a: 1, w: "Brazil" },
  "r32-3": { h: 1, a: 1, w: "Paraguay", pen: true },
  "r32-4": { h: 1, a: 1, w: "Morocco", pen: true },
};

export async function GET(request) {
  const secret = process.env.SYNC_SECRET;
  if (secret) {
    const url = new URL(request.url);
    if (url.searchParams.get("key") !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const sb = supabaseAdmin();
  const { data: rows, error } = await sb.from("groups").select("id, data");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let groupsUpdated = 0, gamesAdded = 0;

  // 1. Add the 16 R32 matchups to every real group's koGames (idempotent).
  for (const row of rows || []) {
    if (row.id === RESULTS_ID) continue;
    const g = row.data || {};
    const existing = g.koGames || [];
    const haveIds = new Set(existing.map((k) => k.id));
    const toAdd = R32_FIXTURES.filter((f) => !haveIds.has(f.id));
    if (toAdd.length === 0) continue;
    g.koGames = [...existing, ...toAdd];
    const { error: wErr } = await sb.from("groups").upsert({ id: row.id, data: g });
    if (wErr) return NextResponse.json({ error: `group ${row.id}: ${wErr.message}` }, { status: 500 });
    groupsUpdated++;
    gamesAdded += toAdd.length;
  }

  // 2. Fill finished R32 results into the shared row — blanks only.
  const { data: resRow } = await sb.from("groups")
    .select("data").eq("id", RESULTS_ID).maybeSingle();
  const current = (resRow && resRow.data && resRow.data.results) ? resRow.data.results : {};
  const merged = { ...current };
  let resultsFilled = 0;
  for (const [id, val] of Object.entries(R32_RESULTS)) {
    if (merged[id] == null) { merged[id] = val; resultsFilled++; }
  }
  if (resultsFilled > 0) {
    const { error: rErr } = await sb.from("groups")
      .upsert({ id: RESULTS_ID, data: { id: RESULTS_ID, results: merged } });
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    groupsUpdated,
    gamesAddedTotal: gamesAdded,
    resultsFilled,
    note: "R32 matchups added to all groups; finished results filled (blanks only).",
  });
}
