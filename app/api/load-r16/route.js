// Jingo v3.4 — /api/load-r16
// One-time (idempotent) loader: adds the 8 official Round-of-16 matchups to
// EVERY group's koGames so the bracket, slate, and scoring see them, and fills
// any finished R16 results into the shared __results__ row (blanks only).
//
//   - Adds only koGames not already present (matched by id). Never duplicates.
//   - Fills finished results only where the slot is blank (manual entry wins).
//   - Preserves the __results__ row's `live` field (display-only live scores).
//   - Skips the reserved __results__ row when adding koGames.
//
// Call once after the R32 is complete:
//   https://YOUR-SITE/api/load-r16?key=YOUR_SYNC_SECRET

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const RESULTS_ID = "__results__";

// The 8 Round-of-16 matchups (R32 is complete, so these are locked). home/away
// follow the bracket slots r16-1..r16-8. Official ET kickoffs, July 4-7, 2026.
const R16_FIXTURES = [
  { id: "r16-1", stage: "r16", home: "Paraguay",      away: "France",   date: "2026-07-04", day: "Sat", time: "5:00 PM" },
  { id: "r16-2", stage: "r16", home: "Canada",        away: "Morocco",  date: "2026-07-04", day: "Sat", time: "1:00 PM" },
  { id: "r16-3", stage: "r16", home: "Portugal",      away: "Spain",    date: "2026-07-06", day: "Mon", time: "3:00 PM" },
  { id: "r16-4", stage: "r16", home: "United States", away: "Belgium",  date: "2026-07-06", day: "Mon", time: "8:00 PM" },
  { id: "r16-5", stage: "r16", home: "Brazil",        away: "Norway",   date: "2026-07-05", day: "Sun", time: "4:00 PM" },
  { id: "r16-6", stage: "r16", home: "Mexico",        away: "England",  date: "2026-07-05", day: "Sun", time: "8:00 PM" },
  { id: "r16-7", stage: "r16", home: "Argentina",     away: "Egypt",    date: "2026-07-07", day: "Tue", time: "12:00 PM" },
  { id: "r16-8", stage: "r16", home: "Switzerland",   away: "Colombia", date: "2026-07-07", day: "Tue", time: "4:00 PM" },
];

// Finished R16 games. {h,a} are on-field goals in the listed home/away
// orientation; w is the advancing team. pen:true = decided on penalties.
const R16_RESULTS = {
  "r16-2": { h: 0, a: 3, w: "Morocco" },  // Canada 0-3 Morocco
  "r16-1": { h: 0, a: 1, w: "France" },   // Paraguay 0-1 France
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

  // 1. Add the 8 R16 matchups to every real group's koGames (idempotent).
  for (const row of rows || []) {
    if (row.id === RESULTS_ID) continue;
    const g = row.data || {};
    const existing = g.koGames || [];
    const haveIds = new Set(existing.map((k) => k.id));
    const toAdd = R16_FIXTURES.filter((f) => !haveIds.has(f.id));
    if (toAdd.length === 0) continue;
    g.koGames = [...existing, ...toAdd];
    const { error: wErr } = await sb.from("groups").upsert({ id: row.id, data: g });
    if (wErr) return NextResponse.json({ error: `group ${row.id}: ${wErr.message}` }, { status: 500 });
    groupsUpdated++;
    gamesAdded += toAdd.length;
  }

  // 2. Fill finished R16 results into the shared row — blanks only. Preserve the
  //    existing `live` field so in-progress display scores aren't wiped.
  const { data: resRow } = await sb.from("groups")
    .select("data").eq("id", RESULTS_ID).maybeSingle();
  const current = (resRow && resRow.data && resRow.data.results) ? resRow.data.results : {};
  const live = (resRow && resRow.data && resRow.data.live) ? resRow.data.live : {};
  const merged = { ...current };
  let resultsFilled = 0;
  for (const [id, val] of Object.entries(R16_RESULTS)) {
    if (merged[id] == null) { merged[id] = val; resultsFilled++; }
  }
  if (resultsFilled > 0) {
    const { error: rErr } = await sb.from("groups")
      .upsert({ id: RESULTS_ID, data: { id: RESULTS_ID, results: merged, live } });
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    groupsUpdated,
    gamesAddedTotal: gamesAdded,
    resultsFilled,
    note: "R16 matchups added to all groups; finished results filled (blanks only).",
  });
}
