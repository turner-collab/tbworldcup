// Jingo v3.2 — /api/sync-results: writes FINISHED games as results and captures
// IN_PLAY/PAUSED games as display-only live scores (data.live). Self-throttles.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { FIXTURE_PAIRS, KICKOFFS } from "@/lib/fixturePairs";

/* ============================================================================
   AUTO-SYNC RESULTS  (/api/sync-results)
   Pulls finished World Cup matches from football-data.org and writes them into
   the shared results row. ONLY fills matches that are currently blank — it will
   never overwrite a score an admin entered by hand. Manual entry always wins.

   Triggered by Vercel Cron (see vercel.json) and can also be hit manually.
   Requires env var FOOTBALL_DATA_TOKEN (your free football-data.org API key).
============================================================================ */

const RESULTS_ID = "__results__";
const FD_URL = "https://api.football-data.org/v4/competitions/WC/matches";

// Kickoff timestamp (ms UTC) from a fixture's ET date + 12-hour clock time.
// EDT = UTC-4 for the tournament window (June–July 2026).
function kickoffTs(date, time) {
  if (!date) return null;
  let mins = 12 * 60;
  if (time) {
    const m = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (m) {
      let h = parseInt(m[1], 10) % 12;
      if (/PM/i.test(m[3])) h += 12;
      mins = h * 60 + parseInt(m[2], 10);
    }
  }
  const [Y, M, D] = date.split("-").map(Number);
  return Date.UTC(Y, M - 1, D, 4, 0, 0) + mins * 60 * 1000;
}

// Our fixtures are keyed group-m1..group-m72 in fixture order. We match an
// incoming match to ours by the (home,away) team-name pair, in either
// orientation, after normalizing names.
function normName(s) {
  if (!s) return "";
  let x = s.toLowerCase().trim();
  // strip accents/diacritics
  x = x.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // unify common provider spellings to a canonical token
  const map = {
    "czech republic": "czechia",
    "korea republic": "south korea",
    "korea dpr": "north korea",
    "ir iran": "iran",
    "turkiye": "turkey",
    "cote d'ivoire": "ivory coast",
    "cote divoire": "ivory coast",
    "cabo verde": "cape verde",
    "usa": "united states",
    "united states of america": "united states",
    "dr congo": "dr congo",
    "congo dr": "dr congo",
    "bosnia & herzegovina": "bosnia and herzegovina",
  };
  if (map[x]) return map[x];
  return x;
}

// Match each incoming match to our fixture id by canonical team pairing.
// FIXTURE_PAIRS is [fixtureId, ourHomeName, ourAwayName] for all 72 group games.

export async function GET(request) {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "FOOTBALL_DATA_TOKEN not set" }, { status: 500 });
  }

  // Simple shared-secret guard: the scheduler must pass ?key=SYNC_SECRET so a
  // random visitor can't trigger syncs. If SYNC_SECRET isn't configured, the
  // guard is skipped (useful for a quick manual browser test).
  const secret = process.env.SYNC_SECRET;
  if (secret) {
    const url = new URL(request.url);
    if (url.searchParams.get("key") !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // --- Self-throttle ---------------------------------------------------------
  // Only call the live-scores API when a match is actually in progress. A match
  // is "in window" from kickoff until kickoff + 3.5h (covers ET, stoppage, and
  // shootouts). Known kickoffs come from KICKOFFS (group + R32); future rounds
  // (R16+) are picked up from each group's koGames at run time. With no match
  // live we return immediately without spending an API call. The scheduler can
  // ping every minute; this keeps real API usage near zero between matches.
  const WINDOW_MS = 3.5 * 60 * 60 * 1000;
  const now = Date.now();
  const url2 = new URL(request.url);
  const force = url2.searchParams.get("force") === "1"; // manual override for testing

  const sbEarly = supabaseAdmin();
  // Collect kickoff times from koGames across groups (for R16+ rounds not in
  // the static list). Cheap single read of all rows.
  let koKickoffs = [];
  try {
    const { data: rowsEarly } = await sbEarly.from("groups").select("id, data");
    const seen = new Set();
    for (const row of rowsEarly || []) {
      if (row.id === RESULTS_ID) continue;
      for (const k of (row.data && row.data.koGames) || []) {
        if (!k.date || seen.has(k.id)) continue;
        seen.add(k.id);
        koKickoffs.push(kickoffTs(k.date, k.time));
      }
    }
  } catch (e) { /* fall back to static list only */ }

  const allKickoffs = [...KICKOFFS, ...koKickoffs];
  const anyLive = force || allKickoffs.some((ko) => ko != null && now >= ko && now <= ko + WINDOW_MS);
  if (!anyLive) {
    return NextResponse.json({ ok: true, skipped: "no live match", checked: allKickoffs.length });
  }

  // 1. Fetch finished matches from the provider
  let providerMatches = [];
  try {
    const r = await fetch(FD_URL, {
      headers: { "X-Auth-Token": token },
      cache: "no-store",
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return NextResponse.json({ error: `provider ${r.status}`, detail }, { status: 502 });
    }
    const j = await r.json();
    providerMatches = j.matches || [];
  } catch (e) {
    return NextResponse.json({ error: "provider fetch failed", detail: String(e) }, { status: 502 });
  }

  // 2. Build pair -> fixtureId lookup (both orientations)
  const pairToId = {};
  for (const [id, home, away] of FIXTURE_PAIRS) {
    pairToId[`${normName(home)}|${normName(away)}`] = id;
    pairToId[`${normName(away)}|${normName(home)}`] = id;
  }

  // 3. Convert provider matches into our data. FINISHED games become real
  //    results (incoming). IN_PLAY/PAUSED games become live snapshots (liveScores)
  //    — display-only, never scored, cleared once the game finishes.
  const incoming = {};
  const liveScores = {};
  for (const m of providerMatches) {
    const status = m.status;
    const isFinished = status === "FINISHED";
    const isLive = status === "IN_PLAY" || status === "PAUSED";
    if (!isFinished && !isLive) continue;
    const home = m.homeTeam && m.homeTeam.name;
    const away = m.awayTeam && m.awayTeam.name;
    if (!home || !away) continue;
    const id = pairToId[`${normName(home)}|${normName(away)}`];
    if (!id) continue; // unknown pairing (e.g. a knockout fixture we don't track)

    // Read a score object that may use either {home,away} or {homeTeam,awayTeam}.
    const readScore = (obj) => {
      if (!obj) return [null, null];
      const h = obj.home != null ? obj.home : obj.homeTeam;
      const a = obj.away != null ? obj.away : obj.awayTeam;
      return [h, a];
    };
    const sc = m.score || {};

    // Resolve OUR home/away orientation for this fixture.
    const pair = FIXTURE_PAIRS.find((p) => p[0] === id);
    const ourHome = pair[1], ourAway = pair[2];
    const providerHomeIsOurHome = normName(home) === normName(ourHome);

    // --- Live, in-progress game: snapshot the current score for display only ---
    if (isLive) {
      // current running score lives in fullTime for in-play matches
      let [lh, la] = readScore(sc.fullTime);
      if (lh == null) [lh, la] = readScore(sc.regularTime);
      if (lh == null) { lh = 0; la = 0; }
      const h = providerHomeIsOurHome ? lh : la;
      const a = providerHomeIsOurHome ? la : lh;
      liveScores[id] = { h, a, status: "live" };
      continue;
    }

    // --- Finished game: compute the real result (as before) ---
    const isPens = sc.duration === "PENALTY_SHOOTOUT";
    let hg, ag;
    if (isPens) {
      [hg, ag] = readScore(sc.regularTime);
      if (hg == null) [hg, ag] = readScore(sc.extraTime);
      if (hg == null) [hg, ag] = readScore(sc.fullTime);
    } else {
      [hg, ag] = readScore(sc.fullTime);
    }
    if (hg == null || ag == null) continue;

    const h = providerHomeIsOurHome ? hg : ag;
    const a = providerHomeIsOurHome ? ag : hg;

    if ((sc.winner === "DRAW" || hg === ag) && !isPens) {
      incoming[id] = { h, a, w: "DRAW" };
      continue;
    }
    let providerWinnerIsHome;
    if (sc.winner === "HOME_TEAM") providerWinnerIsHome = true;
    else if (sc.winner === "AWAY_TEAM") providerWinnerIsHome = false;
    else providerWinnerIsHome = hg > ag;
    const ourWinner = (providerWinnerIsHome === providerHomeIsOurHome) ? ourHome : ourAway;

    if (isPens) incoming[id] = { h, a, w: ourWinner, pen: true };
    else incoming[id] = { h, a, w: ourWinner };
  }

  // 4. Read the current shared results row, fill ONLY blanks for finished games,
  //    and refresh the live snapshot (live is display-only and fully replaced).
  const sb = supabaseAdmin();
  const { data: row } = await sb.from("groups")
    .select("data").eq("id", RESULTS_ID).maybeSingle();
  const current = (row && row.data && row.data.results) ? row.data.results : {};
  const prevLive = (row && row.data && row.data.live) ? row.data.live : {};

  let added = 0;
  const merged = { ...current };
  for (const [id, val] of Object.entries(incoming)) {
    if (merged[id] == null) {        // blank only — never overwrite manual entry
      merged[id] = val;
      added++;
    }
  }

  // Build the new live map: keep only games that are still live AND not yet
  // final. Once a game has a real result, drop it from live so the UI shows FINAL.
  const newLive = {};
  for (const [id, val] of Object.entries(liveScores)) {
    if (merged[id] == null) newLive[id] = val; // still no final result -> show live
  }

  const liveChanged = JSON.stringify(prevLive) !== JSON.stringify(newLive);
  if (added > 0 || liveChanged) {
    const { error: writeErr } = await sb.from("groups")
      .upsert({ id: RESULTS_ID, data: { id: RESULTS_ID, results: merged, live: newLive } });
    if (writeErr) {
      return NextResponse.json({ error: writeErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    providerFinished: providerMatches.filter((m) => m.status === "FINISHED").length,
    liveNow: Object.keys(newLive).length,
    matchedIncoming: Object.keys(incoming).length,
    newlyFilled: added,
  });
}
