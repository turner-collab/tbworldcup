// Jingo v3.6 — /api/load-sf
// One-time (idempotent) loader for the Semifinals. Adds the 2 SF matchups to
// EVERY group's koGames, and fills finished results into the shared __results__
// row (blanks only). Also backfills the last two QF results (qf-3, qf-4) in case
// they weren't yet synced, so the bracket is fully caught up.
//
//   - Adds only koGames not already present (matched by id). Never duplicates.
//   - Fills finished results only where the slot is blank (manual entry wins).
//   - Preserves the __results__ row's `live` field (display-only live scores).
//   - Skips the reserved __results__ row when adding koGames.
//
// Call once (safe to re-run as SF results finalize):
//   https://YOUR-SITE/api/load-sf?key=YOUR_SYNC_SECRET

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const RESULTS_ID = "__results__";

// The 2 Semifinal matchups (QF complete, matchups locked). home/away follow the
// bracket slots sf-1..sf-2. Official ET kickoffs, July 14-15, 2026.
const SF_FIXTURES = [
  { id: "sf-1", stage: "sf", home: "France",  away: "Spain",     date: "2026-07-14", day: "Tue", time: "3:00 PM" },
  { id: "sf-2", stage: "sf", home: "England", away: "Argentina", date: "2026-07-15", day: "Wed", time: "3:00 PM" },
];

// Results to fill (blanks only). The two late QFs are included so the bracket
// is fully caught up; SF_RESULTS is empty until those games go final.
const QF_RESULTS = {
  "qf-3": { h: 1, a: 2, w: "England" },     // Norway 1-2 England
  "qf-4": { h: 3, a: 1, w: "Argentina" },   // Argentina 3-1 Switzerland
};
const SF_RESULTS = {
  // "sf-1": { h: ?, a: ?, w: "?" },  // France vs Spain — fill when final
  // "sf-2": { h: ?, a: ?, w: "?" },  // England vs Argentina — fill when final
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

  // 1. Add the 2 SF matchups to every real group's koGames (idempotent).
  for (const row of rows || []) {
    if (row.id === RESULTS_ID) continue;
    const g = row.data || {};
    const existing = g.koGames || [];
    const haveIds = new Set(existing.map((k) => k.id));
    const toAdd = SF_FIXTURES.filter((f) => !haveIds.has(f.id));
    if (toAdd.length === 0) continue;
    g.koGames = [...existing, ...toAdd];
    const { error: wErr } = await sb.from("groups").upsert({ id: row.id, data: g });
    if (wErr) return NextResponse.json({ error: `group ${row.id}: ${wErr.message}` }, { status: 500 });
    groupsUpdated++;
    gamesAdded += toAdd.length;
  }

  // 2. Fill finished results (late QFs + any final SFs) — blanks only. Preserve
  //    the existing `live` field so in-progress display scores aren't wiped.
  const { data: resRow } = await sb.from("groups")
    .select("data").eq("id", RESULTS_ID).maybeSingle();
  const current = (resRow && resRow.data && resRow.data.results) ? resRow.data.results : {};
  const live = (resRow && resRow.data && resRow.data.live) ? resRow.data.live : {};
  const merged = { ...current };
  let resultsFilled = 0;
  for (const [id, val] of Object.entries({ ...QF_RESULTS, ...SF_RESULTS })) {
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
    note: "SF matchups added to all groups; late QF results filled (blanks only).",
  });
}
