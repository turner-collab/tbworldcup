// Jingo v3.7 — /api/load-final
// One-time (idempotent) loader for the Final. Adds the Final matchup to EVERY
// group's koGames, and fills the SF + Final results into the shared __results__
// row (blanks only) so the bracket, recap, and scoring are fully caught up.
//
//   - Adds only koGames not already present (matched by id). Never duplicates.
//   - Fills finished results only where the slot is blank (manual entry wins).
//   - Preserves the __results__ row's `live` field.
//   - Skips the reserved __results__ row when adding koGames.
//
// Call once after the Final is played:
//   https://YOUR-SITE/api/load-final?key=YOUR_SYNC_SECRET

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const RESULTS_ID = "__results__";

// The Final (SF complete, matchup locked: Spain vs Argentina). home/away follow
// the bracket slot final-1. Official ET kickoff July 19, 2026.
const FINAL_FIXTURES = [
  { id: "final-1", stage: "final", home: "Spain", away: "Argentina", date: "2026-07-19", day: "Sun", time: "3:00 PM" },
];

// Results to fill (blanks only). Includes both semifinals so the bracket is
// fully caught up, plus the Final. {h,a} in the listed home/away orientation;
// w is the advancing/winning team.
const SF_RESULTS = {
  "sf-1": { h: 0, a: 2, w: "Spain" },       // France 0-2 Spain
  "sf-2": { h: 1, a: 2, w: "Argentina" },   // England 1-2 Argentina
};
const FINAL_RESULTS = {
  "final-1": { h: 1, a: 0, w: "Spain" },     // Spain 1-0 Argentina (a.e.t.)
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

  // 1. Add the Final matchup to every real group's koGames (idempotent).
  for (const row of rows || []) {
    if (row.id === RESULTS_ID) continue;
    const g = row.data || {};
    const existing = g.koGames || [];
    const haveIds = new Set(existing.map((k) => k.id));
    const toAdd = FINAL_FIXTURES.filter((f) => !haveIds.has(f.id));
    if (toAdd.length === 0) continue;
    g.koGames = [...existing, ...toAdd];
    const { error: wErr } = await sb.from("groups").upsert({ id: row.id, data: g });
    if (wErr) return NextResponse.json({ error: `group ${row.id}: ${wErr.message}` }, { status: 500 });
    groupsUpdated++;
    gamesAdded += toAdd.length;
  }

  // 2. Fill SF + Final results — blanks only. Preserve the existing `live` field.
  const { data: resRow } = await sb.from("groups")
    .select("data").eq("id", RESULTS_ID).maybeSingle();
  const current = (resRow && resRow.data && resRow.data.results) ? resRow.data.results : {};
  const live = (resRow && resRow.data && resRow.data.live) ? resRow.data.live : {};
  const merged = { ...current };
  let resultsFilled = 0;
  for (const [id, val] of Object.entries({ ...SF_RESULTS, ...FINAL_RESULTS })) {
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
    note: "Final added to all groups; SF + Final results filled (blanks only). Spain are champions.",
  });
}
