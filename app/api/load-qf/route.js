// Jingo v3.5 — /api/load-qf
// One-time (idempotent) loader: adds the 4 Quarterfinal matchups to EVERY
// group's koGames so the bracket, slate, and scoring see them, and fills any
// finished QF results into the shared __results__ row (blanks only).
//
//   - Adds only koGames not already present (matched by id). Never duplicates.
//   - Fills finished results only where the slot is blank (manual entry wins).
//   - Preserves the __results__ row's `live` field (display-only live scores).
//   - Skips the reserved __results__ row when adding koGames.
//
// Call once (safe to re-run as more QFs finish; re-running just fills newly
// added QF results and skips games already present):
//   https://YOUR-SITE/api/load-qf?key=YOUR_SYNC_SECRET

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const RESULTS_ID = "__results__";

// The 4 Quarterfinal matchups (R16 complete, so these are locked). home/away
// follow the bracket slots qf-1..qf-4. Official ET kickoffs, July 9-11, 2026.
const QF_FIXTURES = [
  { id: "qf-1", stage: "qf", home: "France",    away: "Morocco",     date: "2026-07-09", day: "Thu", time: "4:00 PM" },
  { id: "qf-2", stage: "qf", home: "Spain",     away: "Belgium",     date: "2026-07-10", day: "Fri", time: "3:00 PM" },
  { id: "qf-3", stage: "qf", home: "Norway",    away: "England",     date: "2026-07-11", day: "Sat", time: "5:00 PM" },
  { id: "qf-4", stage: "qf", home: "Argentina", away: "Switzerland", date: "2026-07-11", day: "Sat", time: "9:00 PM" },
];

// Finished QF games. {h,a} are on-field goals in the listed home/away
// orientation; w is the advancing team. pen:true = decided on penalties.
// (Only the two completed QFs so far; re-run this route to fill the rest.)
const QF_RESULTS = {
  "qf-1": { h: 2, a: 0, w: "France" },  // France 2-0 Morocco
  "qf-2": { h: 2, a: 1, w: "Spain" },   // Spain 2-1 Belgium
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

  // 1. Add the 4 QF matchups to every real group's koGames (idempotent).
  for (const row of rows || []) {
    if (row.id === RESULTS_ID) continue;
    const g = row.data || {};
    const existing = g.koGames || [];
    const haveIds = new Set(existing.map((k) => k.id));
    const toAdd = QF_FIXTURES.filter((f) => !haveIds.has(f.id));
    if (toAdd.length === 0) continue;
    g.koGames = [...existing, ...toAdd];
    const { error: wErr } = await sb.from("groups").upsert({ id: row.id, data: g });
    if (wErr) return NextResponse.json({ error: `group ${row.id}: ${wErr.message}` }, { status: 500 });
    groupsUpdated++;
    gamesAdded += toAdd.length;
  }

  // 2. Fill finished QF results into the shared row — blanks only. Preserve the
  //    existing `live` field so in-progress display scores aren't wiped.
  const { data: resRow } = await sb.from("groups")
    .select("data").eq("id", RESULTS_ID).maybeSingle();
  const current = (resRow && resRow.data && resRow.data.results) ? resRow.data.results : {};
  const live = (resRow && resRow.data && resRow.data.live) ? resRow.data.live : {};
  const merged = { ...current };
  let resultsFilled = 0;
  for (const [id, val] of Object.entries(QF_RESULTS)) {
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
    note: "QF matchups added to all groups; finished results filled (blanks only).",
  });
}
