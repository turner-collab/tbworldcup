"use client";
// Jingo v3.6 — live scores (display-only) + R32 Knockouts page (bracket/group/R32
// summaries, round points) + Jingo home header w/ back button + link-preview ready.
import React, { useState, useEffect, useMemo, useCallback } from "react";

/* ============================================================================
   WORLD CUP DRAFT — single-file app
   Persistence: Supabase via /api/groups routes (see STORAGE below).
   Notifications: NOTIFY.draftTurn() is a stub that logs. Wire Twilio there
   (server-side) by replacing the body with a fetch to your /notify endpoint.
============================================================================ */

// Organizer password. Change this to whatever you want to hand out.
const ORGANIZER_PASSWORD = "worldcup2026";
// Admin password for the score-entry login on the main screen.
const ADMIN_PASSWORD = "sharkthedog";

/* ---------- Tournament data (2026 World Cup, all 48 teams) ---------- */
const GROUPS = {
  A: ["Mexico", "South Korea", "South Africa", "Czechia"],
  B: ["Canada", "Switzerland", "Qatar", "Bosnia and Herzegovina"],
  C: ["Brazil", "Morocco", "Scotland", "Haiti"],
  D: ["United States", "Australia", "Paraguay", "Türkiye"],
  E: ["Germany", "Ecuador", "Ivory Coast", "Curaçao"],
  F: ["Netherlands", "Japan", "Tunisia", "Sweden"],
  G: ["Belgium", "Iran", "Egypt", "New Zealand"],
  H: ["Spain", "Uruguay", "Saudi Arabia", "Cape Verde"],
  I: ["France", "Senegal", "Norway", "Iraq"],
  J: ["Argentina", "Austria", "Algeria", "Jordan"],
  K: ["Portugal", "Colombia", "Uzbekistan", "DR Congo"],
  L: ["England", "Croatia", "Ghana", "Panama"],
};
const FLAG = {
  Mexico: "🇲🇽", "South Korea": "🇰🇷", "South Africa": "🇿🇦", Czechia: "🇨🇿",
  Canada: "🇨🇦", Switzerland: "🇨🇭", Qatar: "🇶🇦", "Bosnia and Herzegovina": "🇧🇦",
  Brazil: "🇧🇷", Morocco: "🇲🇦", Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", Haiti: "🇭🇹",
  "United States": "🇺🇸", Australia: "🇦🇺", Paraguay: "🇵🇾", "Türkiye": "🇹🇷",
  Germany: "🇩🇪", Ecuador: "🇪🇨", "Ivory Coast": "🇨🇮", "Curaçao": "🇨🇼",
  Netherlands: "🇳🇱", Japan: "🇯🇵", Tunisia: "🇹🇳", Sweden: "🇸🇪",
  Belgium: "🇧🇪", Iran: "🇮🇷", Egypt: "🇪🇬", "New Zealand": "🇳🇿",
  Spain: "🇪🇸", Uruguay: "🇺🇾", "Saudi Arabia": "🇸🇦", "Cape Verde": "🇨🇻",
  France: "🇫🇷", Senegal: "🇸🇳", Norway: "🇳🇴", Iraq: "🇮🇶",
  Argentina: "🇦🇷", Austria: "🇦🇹", Algeria: "🇩🇿", Jordan: "🇯🇴",
  Portugal: "🇵🇹", Colombia: "🇨🇴", Uzbekistan: "🇺🇿", "DR Congo": "🇨🇩",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Croatia: "🇭🇷", Ghana: "🇬🇭", Panama: "🇵🇦",
};
const ALL_TEAMS = Object.entries(GROUPS).flatMap(([g, ts]) =>
  ts.map((t) => ({ name: t, group: g }))
);

const STAGES = [
  { key: "group", label: "Group stage", pts: 1 },
  { key: "r32", label: "Round of 32", pts: 2 },
  { key: "r16", label: "Round of 16", pts: 3 },
  { key: "qf", label: "Quarterfinal", pts: 5 },
  { key: "sf", label: "Semifinal", pts: 8 },
  { key: "final", label: "Final", pts: 13 },
];
const DEFAULT_POINTS = Object.fromEntries(STAGES.map((s) => [s.key, s.pts]));

/* ============================================================================
   OFFICIAL 2026 WORLD CUP ROUND OF 32 BRACKET
   The 16 R32 matchups with ET kickoff dates/times, plus the games already
   finished. Used by the admin "Load R32 bracket" action to add knockout games
   to every group at once. IDs are stable (r32-N) so re-running is idempotent.
   Teams use the app's canonical names so ownerOf() matches.
============================================================================ */
// Round of 16. R32 complete, matchups locked. home/away follow bracket slots.
// Official ET kickoffs, July 4-7, 2026.
const R16_FIXTURES = [
  { id: "r16-1", home: "Paraguay",    away: "France",   date: "2026-07-04", day: "Sat", time: "5:00 PM" },
  { id: "r16-2", home: "Canada",      away: "Morocco",  date: "2026-07-04", day: "Sat", time: "1:00 PM" },
  { id: "r16-3", home: "Portugal",    away: "Spain",    date: "2026-07-06", day: "Mon", time: "3:00 PM" },
  { id: "r16-4", home: "United States",away: "Belgium", date: "2026-07-06", day: "Mon", time: "8:00 PM" },
  { id: "r16-5", home: "Brazil",      away: "Norway",   date: "2026-07-05", day: "Sun", time: "4:00 PM" },
  { id: "r16-6", home: "Mexico",      away: "England",  date: "2026-07-05", day: "Sun", time: "8:00 PM" },
  { id: "r16-7", home: "Argentina",   away: "Egypt",    date: "2026-07-07", day: "Tue", time: "12:00 PM" },
  { id: "r16-8", home: "Switzerland", away: "Colombia", date: "2026-07-07", day: "Tue", time: "4:00 PM" },
];
const R16_RESULTS = {
  "r16-1": { h: 0, a: 1, w: "France" },        // Paraguay 0-1 France
  "r16-2": { h: 0, a: 3, w: "Morocco" },       // Canada 0-3 Morocco
  "r16-3": { h: 0, a: 1, w: "Spain" },         // Portugal 0-1 Spain
  "r16-4": { h: 1, a: 4, w: "Belgium" },       // United States 1-4 Belgium
  "r16-5": { h: 1, a: 2, w: "Norway" },        // Brazil 1-2 Norway
  "r16-6": { h: 2, a: 3, w: "England" },       // Mexico 2-3 England
  "r16-7": { h: 3, a: 2, w: "Argentina" },     // Argentina 3-2 Egypt
  "r16-8": { h: 0, a: 0, w: "Switzerland", pen: true, ph: 4, pa: 3 }, // 0-0, SUI win 4-3 pens
};
// Quarterfinals. R16 complete, matchups locked. home/away follow bracket slots
// qf-1..qf-4. Official ET kickoffs, July 9-11, 2026.
const QF_FIXTURES = [
  { id: "qf-1", home: "France",    away: "Morocco",     date: "2026-07-09", day: "Thu", time: "4:00 PM" },
  { id: "qf-2", home: "Spain",     away: "Belgium",     date: "2026-07-10", day: "Fri", time: "3:00 PM" },
  { id: "qf-3", home: "Norway",    away: "England",     date: "2026-07-11", day: "Sat", time: "5:00 PM" },
  { id: "qf-4", home: "Argentina", away: "Switzerland", date: "2026-07-11", day: "Sat", time: "9:00 PM" },
];
const QF_RESULTS = {
  "qf-1": { h: 2, a: 0, w: "France" },      // France 2-0 Morocco
  "qf-2": { h: 2, a: 1, w: "Spain" },       // Spain 2-1 Belgium
  "qf-3": { h: 1, a: 2, w: "England" },     // Norway 1-2 England
  "qf-4": { h: 3, a: 1, w: "Argentina" },   // Argentina 3-1 Switzerland
};
// Semifinals. QF complete, matchups locked. home/away follow bracket slots
// sf-1..sf-2. Official ET kickoffs, July 14-15, 2026.
const SF_FIXTURES = [
  { id: "sf-1", home: "France",  away: "Spain",     date: "2026-07-14", day: "Tue", time: "3:00 PM" },
  { id: "sf-2", home: "England", away: "Argentina", date: "2026-07-15", day: "Wed", time: "3:00 PM" },
];
const SF_RESULTS = {};
const R32_FIXTURES = [
  { id: "r32-1",  home: "South Africa", away: "Canada",   date: "2026-06-28", day: "Sun", time: "3:00 PM" },
  { id: "r32-2",  home: "Brazil",       away: "Japan",    date: "2026-06-29", day: "Mon", time: "1:00 PM" },
  { id: "r32-3",  home: "Germany",      away: "Paraguay", date: "2026-06-29", day: "Mon", time: "4:30 PM" },
  { id: "r32-4",  home: "Netherlands",  away: "Morocco",  date: "2026-06-29", day: "Mon", time: "9:00 PM" },
  { id: "r32-5",  home: "Ivory Coast",  away: "Norway",   date: "2026-06-30", day: "Tue", time: "1:00 PM" },
  { id: "r32-6",  home: "France",       away: "Sweden",   date: "2026-06-30", day: "Tue", time: "5:00 PM" },
  { id: "r32-7",  home: "Mexico",       away: "Ecuador",  date: "2026-06-30", day: "Tue", time: "9:00 PM" },
  { id: "r32-8",  home: "England",      away: "DR Congo", date: "2026-07-01", day: "Wed", time: "12:00 PM" },
  { id: "r32-9",  home: "Belgium",      away: "Senegal",  date: "2026-07-01", day: "Wed", time: "4:00 PM" },
  { id: "r32-10", home: "United States",away: "Bosnia and Herzegovina", date: "2026-07-01", day: "Wed", time: "8:00 PM" },
  { id: "r32-11", home: "Spain",        away: "Austria",  date: "2026-07-02", day: "Thu", time: "3:00 PM" },
  { id: "r32-12", home: "Portugal",     away: "Croatia",  date: "2026-07-02", day: "Thu", time: "7:00 PM" },
  { id: "r32-13", home: "Switzerland",  away: "Algeria",  date: "2026-07-02", day: "Thu", time: "11:00 PM" },
  { id: "r32-14", home: "Australia",    away: "Egypt",    date: "2026-07-03", day: "Fri", time: "2:00 PM" },
  { id: "r32-15", home: "Argentina",    away: "Cape Verde", date: "2026-07-03", day: "Fri", time: "6:00 PM" },
  { id: "r32-16", home: "Colombia",     away: "Ghana",    date: "2026-07-03", day: "Fri", time: "9:30 PM" },
];
// R32 games already completed. {h,a} are goals in the fixture's listed home/away
// orientation; w is the advancing team (pen:true where decided on penalties).
const R32_RESULTS = {
  "r32-1": { h: 0, a: 1, w: "Canada" },                 // South Africa 0-1 Canada
  "r32-2": { h: 2, a: 1, w: "Brazil" },                 // Brazil 2-1 Japan
  "r32-3": { h: 1, a: 1, w: "Paraguay", pen: true },    // Germany 1-1 Paraguay (pens 3-4)
  "r32-4": { h: 1, a: 1, w: "Morocco", pen: true },     // Netherlands 1-1 Morocco (pens 2-3)
};


/* Scoring themes — group picks one at setup. `bonus(game, winner)` returns
   extra points credited to the winning team's owner for that game. */
const THEMES = {
  goats: {
    label: "Men who stare at GOATs",
    blurb: "Extra points whenever your team beats Portugal or Argentina.",
    targets: ["Portugal", "Argentina"], amount: 5,
    bonus(loser) { return this.targets.includes(loser) ? this.amount : 0; },
  },
  turtles: {
    label: "Turtles all the way down",
    blurb: "Extra points whenever your team beats France.",
    targets: ["France"], amount: 5,
    bonus(loser) { return this.targets.includes(loser) ? this.amount : 0; },
  },
  murica: {
    label: "MURICA",
    blurb: "Extra points every time the USA wins (if you drafted them).",
    targets: ["United States"], amount: 3,
    bonus(loser, winner) { return winner === "United States" ? this.amount : 0; },
  },
};
const DEFAULT_THEME = "goats";

/* ---------- Storage layer: Supabase-backed API routes ----------
   get/set hit /api/groups, patch does an atomic server-side merge, del removes. */
const INDEX_KEY = "wc:groups:index";
const groupKey = (id) => `wc:group:${id}`;
const idFromKey = (key) => key.startsWith("wc:group:") ? key.slice("wc:group:".length) : null;

const STORAGE = {
  async get(key) {
    try {
      if (key === INDEX_KEY) {
        const r = await fetch("/api/groups", { cache: "no-store" });
        if (!r.ok) return [];
        const j = await r.json();
        return j.index || [];
      }
      const id = idFromKey(key);
      if (id) {
        const r = await fetch(`/api/groups/${id}`, { cache: "no-store" });
        if (r.status === 404) return null;
        if (!r.ok) return null;
        const j = await r.json();
        return j.group || null;
      }
      return null;
    } catch (e) { console.error("STORAGE.get failed", e); return null; }
  },
  async set(key, value) {
    try {
      if (key === INDEX_KEY) return true;
      const id = idFromKey(key);
      if (id) {
        const r = await fetch(`/api/groups/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ group: value }),
        });
        if (!r.ok) {
          const detail = await r.text().catch(() => "");
          console.error(`STORAGE.set failed: ${r.status} ${detail}`);
        }
        return r.ok;
      }
      return false;
    } catch (e) { console.error("STORAGE.set failed", e); return false; }
  },
  async listKeys() { return []; },
  async del(key) {
    const id = idFromKey(key);
    if (!id) return false;
    try {
      const r = await fetch(`/api/groups/${id}`, { method: "DELETE" });
      return r.ok;
    } catch (e) { console.error("STORAGE.del failed", e); return false; }
  },
  async patch(id, payload) {
    try {
      const r = await fetch(`/api/groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const detail = await r.text().catch(() => "");
        console.error(`STORAGE.patch ${payload && payload.op} failed: ${r.status} ${detail}`);
        return null;
      }
      const j = await r.json();
      return j.group || null;
    } catch (e) { console.error("STORAGE.patch failed", e); return null; }
  },
  // Server-side phone lookup across all groups (robust login).
  async findByPhone(phone) {
    try {
      const r = await fetch(`/api/groups?phone=${encodeURIComponent(phone)}`, { cache: "no-store" });
      if (!r.ok) return null;
      const j = await r.json();
      if (!j || !Array.isArray(j.groups)) return null;
      return j.groups;
    } catch (e) { console.error("STORAGE.findByPhone failed", e); return null; }
  },
};

/* ---------- Shared tournament results ----------
   Results are global to the whole tournament, NOT per group. One match has one
   score, and every group reads the same one. Stored under a single key.
   A result is { h: homeGoals, a: awayGoals, w: winningTeam }. For a group-stage
   draw, w is "DRAW". For knockouts the admin always sets a winner (penalties if
   level). Legacy data where a result is just a team-name string is still read
   correctly via winnerOf(). */
const _resultSubs = new Set();
// Shared tournament results are stored in a single reserved row of the same
// `groups` table (id "__results__"), so one admin score entry is visible to
// every group. This needs no new table or API route — it reuses the existing
// get/set-by-id endpoints. Real groups' own g.results are never touched.
const RESULTS_ID = "__results__";
const RESULTS_KEY = groupKey(RESULTS_ID);
let _resultsCache = null;
let _liveCache = {};

const RESULTS = {
  async load() {
    const data = (await STORAGE.get(RESULTS_KEY)) || {};
    // the row may be wrapped as a "group" object; accept either shape
    const map = data && data.results ? data.results : (data && !data.id ? data : {});
    _resultsCache = map || {};
    // in-progress (live) scores ride alongside results in the same row
    _liveCache = (data && data.live) ? data.live : {};
    return _resultsCache;
  },
  get() { return _resultsCache || {}; },
  async set(matchId, value) {
    const cur = { ...(await this.load()) };
    if (value == null) delete cur[matchId];
    else cur[matchId] = value;
    _resultsCache = cur;
    // preserve the live snapshot so a manual score entry doesn't wipe it
    await STORAGE.set(RESULTS_KEY, { id: RESULTS_ID, results: cur, live: _liveCache });
    _resultSubs.forEach((fn) => fn(cur));
    return cur;
  },
  subscribe(fn) { _resultSubs.add(fn); return () => _resultSubs.delete(fn); },
};

// In-progress (live) scores — display only, never scored. Refreshed from the
// feed via RESULTS.load() (which reads the row's `live` field).
const LIVE = {
  get() { return _liveCache || {}; },
  getOne(id) { return (_liveCache || {})[id] || null; },
  set(map) {
    _liveCache = map || {};
    _resultSubs.forEach((fn) => fn(_resultsCache || {}));
  },
};


// Derive the winning team from a result value (handles goals object,
// legacy string, and "DRAW"). Returns null if no decisive winner.
function winnerOf(res) {
  if (!res) return null;
  if (typeof res === "string") return res === "DRAW" ? null : res;
  if (res.w) return res.w === "DRAW" ? null : res.w;
  return null;
}
function isDraw(res) {
  if (!res) return false;
  if (typeof res === "string") return res === "DRAW";
  return res.w === "DRAW";
}
// "2–1" style score string, or null if no goals recorded.
function scoreText(res) {
  if (!res || typeof res === "string") return null;
  if (res.h == null || res.a == null) return null;
  return `${res.h}–${res.a}`;
}

// Hook: live shared results, re-rendering when any score changes.
function useSharedResults(livePollActive) {
  const [results, setResults] = useState(() => RESULTS.get());
  useEffect(() => {
    let alive = true;
    RESULTS.load().then((r) => { if (alive) setResults({ ...r }); });
    const unsub = RESULTS.subscribe((r) => setResults({ ...r }));
    // Only poll when a live game is in progress, and then every 5 minutes.
    // With no live game there's nothing to update, so we skip polling entirely.
    let iv = null;
    if (livePollActive) {
      iv = setInterval(() => {
        RESULTS.load().then((r) => { if (alive) setResults({ ...r }); });
      }, 5 * 60 * 1000);
    }
    return () => { alive = false; unsub(); if (iv) clearInterval(iv); };
  }, [livePollActive]);
  return results;
}


/* ---------- Notification stub (wire Twilio server-side here) ---------- */
const NOTIFY = {
  async draftTurn(player, group) {
    // Replace with: await fetch('/api/notify', {method:'POST', body: JSON.stringify({phone: player.phone, msg})})
    const msg = `${player.name}, you're on the clock in "${group.name}". Tap to draft: ${group.shareLink || "(your app link)"}`;
    console.log("[NOTIFY]", player.phone || "(no phone)", msg);
    return true;
  },
};

/* ---------- Draft order helper (snake / down-and-back) ---------- */
function snakeOrder(numPlayers, totalPicks) {
  const order = [];
  let round = 0;
  while (order.length < totalPicks) {
    const seq = round % 2 === 0
      ? [...Array(numPlayers).keys()]
      : [...Array(numPlayers).keys()].reverse();
    for (const p of seq) {
      if (order.length >= totalPicks) break;
      order.push(p);
    }
    round++;
  }
  return order;
}
// Fisher-Yates shuffle of [0..n-1] for a random first-round order.
function shuffledIndices(n) {
  const a = [...Array(n).keys()];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Snake draft built from a given first-round order (e.g. a random shuffle).
function snakeOrderFrom(baseOrder, totalPicks) {
  const order = [];
  let round = 0;
  while (order.length < totalPicks) {
    const seq = round % 2 === 0 ? baseOrder : [...baseOrder].reverse();
    for (const p of seq) {
      if (order.length >= totalPicks) break;
      order.push(p);
    }
    round++;
  }
  return order;
}
function uid() {
  return Math.random().toString(36).slice(2, 9);
}
// Poll a group from the server on an interval so multiple phones stay in sync.
// Skips refresh while a local save is in flight to avoid clobbering edits.
function usePolledGroup(id, { intervalMs = 4000 } = {}) {
  const [g, setG] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const savingRef = React.useRef(false);
  const localStampRef = React.useRef(0); // bumped on every local change
  const missCountRef = React.useRef(0); // consecutive null reads

  const refresh = useCallback(async () => {
    if (savingRef.current) return;
    const startStamp = localStampRef.current;
    const data = await STORAGE.get(groupKey(id));
    // If a local change happened while this read was in flight, drop the result
    // so we never overwrite fresher local state with a stale server copy.
    if (startStamp !== localStampRef.current || savingRef.current) return;
    if (data === null) {
      missCountRef.current += 1;
      setG((prev) => { if (!prev && missCountRef.current >= 3) setNotFound(true); return prev; });
      return;
    }
    missCountRef.current = 0;
    setNotFound(false);
    setG((prev) => {
      if (prev && JSON.stringify(prev) === JSON.stringify(data)) return prev;
      return data;
    });
  }, [id]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, intervalMs);
    return () => clearInterval(t);
  }, [refresh, intervalMs]);

  const save = useCallback(async (next) => {
    savingRef.current = true;
    localStampRef.current += 1;
    setG(next);
    await STORAGE.set(groupKey(id), next);
    savingRef.current = false;
  }, [id]);

  // Atomic single-field change via the server PATCH endpoint. The server
  // returns the authoritative merged group, which we adopt locally.
  const patch = useCallback(async (payload) => {
    savingRef.current = true;
    localStampRef.current += 1;
    const updated = await STORAGE.patch(id, payload);
    if (updated) setG(updated);
    savingRef.current = false;
    return updated;
  }, [id]);

  return { g, setG, notFound, save, patch, refresh };
}
// Strip everything but digits so formatting differences don't block login.
function normPhone(s) {
  return (s || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
}
function fmtClock(s) {
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/* ====================================================================== */
export default function App() {
  const [route, setRoute] = useState({ name: "landing" });
  const [index, setIndex] = useState(null); // [{id,name}]
  const [loading, setLoading] = useState(true);
  const [inviteId, setInviteId] = useState(null);
  const [orgUnlocked, setOrgUnlocked] = useState(false); // organizer password gate
  const [adminUnlocked, setAdminUnlocked] = useState(false); // score-admin gate

  const loadIndex = useCallback(async () => {
    const idx = (await STORAGE.get(INDEX_KEY)) || [];
    setIndex(idx);
    setLoading(false);
  }, []);
  useEffect(() => { loadIndex(); }, [loadIndex]);

  // If opened via an invite link (?g=GROUPID), send straight to player login.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const g = params.get("g");
    if (g) { setInviteId(g); setRoute({ name: "login", inviteId: g }); }
  }, [loadIndex]);

  if (loading) return <Shell><Spinner /></Shell>;

  return (
    <Shell>
      {route.name === "landing" && (
        <Landing
          onPlayer={() => setRoute({ name: "login" })}
          onAdmin={() => setRoute({ name: adminUnlocked ? "adminHome" : "adminPassword" })} />
      )}
      {route.name === "adminPassword" && (
        <OrganizerPassword admin onBack={() => setRoute({ name: "landing" })}
          onUnlock={() => { setAdminUnlocked(true); setRoute({ name: "adminHome" }); }} />
      )}
      {route.name === "adminHome" && (
        <AdminHome
          onBack={() => setRoute({ name: "landing" })}
          onGroups={() => setRoute({ name: "adminGroups" })}
          onScores={() => setRoute({ name: "adminScores" })} />
      )}
      {route.name === "adminGroups" && (
        <AdminManageGroups index={index}
          onBack={() => setRoute({ name: "adminHome" })}
          onOpen={(id) => setRoute({ name: "adminGroupDetail", id })}
          onNew={() => setRoute({ name: "new" })} />
      )}
      {route.name === "adminGroupDetail" && (
        <AdminGroupDetail id={route.id}
          onBack={() => setRoute({ name: "adminGroups" })} />
      )}
      {route.name === "adminScores" && (
        <AdminAllScores onBack={() => setRoute({ name: "adminHome" })} />
      )}
      {route.name === "login" && (
        <PlayerLogin onBack={() => setRoute({ name: "landing" })}
          inviteId={route.inviteId || inviteId}
          onFound={(phone) => setRoute({ name: "myGroups", phone })} />
      )}
      {route.name === "myGroups" && (
        <PlayerGroups phone={route.phone}
          onBack={() => setRoute({ name: "login" })}
          onOpen={(id) => setRoute({ name: "playerView", id, phone: route.phone })} />
      )}
      {route.name === "playerView" && (
        <PlayerView id={route.id} phone={route.phone} playerId={route.playerId}
          onBack={() => route.fromGroup
            ? setRoute({ name: "group", id: route.id })
            : setRoute({ name: "myGroups", phone: route.phone })} />
      )}
      {route.name === "home" && (
        <Home index={index}
          onOpen={(id) => setRoute({ name: "group", id })}
          onNew={() => setRoute({ name: "new" })}
          onExit={() => setRoute({ name: "landing" })}
          onDelete={async (id) => {
            await STORAGE.del(groupKey(id));
            const idx = (await STORAGE.get(INDEX_KEY)) || [];
            await STORAGE.set(INDEX_KEY, idx.filter((e) => e.id !== id));
            await loadIndex();
          }} />
      )}
      {route.name === "new" && (
        <NewGroup onCancel={() => setRoute({ name: "adminGroups" })}
          onCreated={async (id) => { await loadIndex(); setRoute({ name: "adminGroupDetail", id }); }} />
      )}
      {route.name === "group" && (
        <GroupView id={route.id}
          onBack={async () => { await loadIndex(); setRoute({ name: "adminGroups" }); }}
          onPlayAs={(playerId) => setRoute({ name: "playerView", id: route.id, playerId, fromGroup: true })} />
      )}
    </Shell>
  );
}

/* ---------- Landing: choose organizer or player ---------- */
function Landing({ onPlayer, onAdmin }) {
  return (
    <>
      <header style={{ paddingTop: 48, paddingBottom: 28 }}>
        <h1 style={{ font: "800 46px/0.95 'Space Grotesk', sans-serif",
          letterSpacing: "-0.03em", margin: 0 }}>Jingo</h1>
        <p style={{ fontSize: 16, fontWeight: 600, marginTop: 12, marginBottom: 0,
          opacity: 0.9 }}>Rabid Support For Every Nation</p>
        <div style={{ fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase",
          color: S.accent, fontWeight: 700, marginTop: 8 }}>2026 World Cup</div>
      </header>
      <button onClick={onPlayer} className="big-choice" style={{ borderColor: S.accent }}>
        <span style={{ fontSize: 28 }}>📱</span>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>I'm a player</div>
          <div style={{ opacity: 0.6, fontSize: 13.5, marginTop: 2 }}>
            Log in with your phone to see your roster and standings
          </div>
        </div>
      </button>
      <button onClick={onAdmin} className="big-choice">
        <span style={{ fontSize: 28 }}>🛠️</span>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Admin</div>
          <div style={{ opacity: 0.6, fontSize: 13.5, marginTop: 2 }}>
            Manage groups and enter scores
          </div>
        </div>
      </button>
    </>
  );
}

/* ---------- Organizer / Admin password gate ---------- */
function OrganizerPassword({ onBack, onUnlock, admin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  function submit() {
    if (pw === (admin ? ADMIN_PASSWORD : ORGANIZER_PASSWORD)) onUnlock();
    else { setErr("That's not the right password."); }
  }
  return (
    <>
      <Header title={admin ? "Score admin" : "Organizer access"} onBack={onBack}
        sub={admin ? "Enter the admin password to record match results."
          : "Enter the password to create and manage groups."} />
      <label style={lbl}>Password</label>
      <input className="inp" type="password" placeholder="••••••••"
        value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }}
        onKeyDown={(e) => e.key === "Enter" && submit()} autoFocus />
      {err && <p style={{ color: "#ff8095", fontSize: 13, marginTop: 8 }}>{err}</p>}
      <button className="primary" onClick={submit}
        style={{ width: "100%", marginTop: 16 }}>Continue</button>
    </>
  );
}

/* ---------- Admin home: two options ---------- */
function AdminHome({ onBack, onGroups, onScores }) {
  return (
    <>
      <Header title="Admin" onBack={onBack} sub="Manage your leagues and results." />
      <button onClick={onGroups} className="big-choice" style={{ borderColor: S.accent }}>
        <span style={{ fontSize: 28 }}>🗂️</span>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Manage Groups</div>
          <div style={{ opacity: 0.6, fontSize: 13.5, marginTop: 2 }}>
            See every group, its players, scores, and last login
          </div>
        </div>
      </button>
      <button onClick={onScores} className="big-choice">
        <span style={{ fontSize: 28 }}>⚽</span>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Manage Scores</div>
          <div style={{ opacity: 0.6, fontSize: 13.5, marginTop: 2 }}>
            Enter goal scores for each match (equal score = draw)
          </div>
        </div>
      </button>
    </>
  );
}

/* ---------- Admin: list of all active groups ---------- */
function AdminManageGroups({ index, onBack, onOpen, onNew }) {
  return (
    <>
      <Header title="Manage Groups" onBack={onBack}
        sub="Every active group on the app. Tap one for details." />
      {(!index || index.length === 0) ? (
        <div style={{ ...card, textAlign: "center", padding: "32px 20px" }}>
          <p style={{ opacity: 0.7, margin: 0 }}>No groups yet.</p>
        </div>
      ) : index.map((g) => (
        <button key={g.id} onClick={() => onOpen(g.id)} className="row-card">
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{g.name}</div>
            <div style={{ opacity: 0.5, fontSize: 13, marginTop: 2 }}>
              {g.players} player{g.players === 1 ? "" : "s"} · tap to view
            </div>
          </div>
          <span style={{ opacity: 0.4 }}>→</span>
        </button>
      ))}
      {onNew && (
        <button onClick={onNew} className="primary"
          style={{ width: "100%", marginTop: 14 }}>+ New group</button>
      )}
    </>
  );
}

/* ---------- Admin: one group's detail — players, scores, last login ---------- */
function AdminGroupDetail({ id, onBack }) {
  const { g, notFound } = usePolledGroup(id);
  useSharedResults(); // recompute scores live as results change
  if (notFound) return (
    <div style={{ ...card, textAlign: "center", marginTop: 32 }}>
      <p style={{ opacity: 0.7 }}>Couldn't load this group.</p>
      <button className="primary" onClick={onBack} style={{ marginTop: 10 }}>Back</button>
    </div>
  );
  if (!g) return <Spinner />;

  const rows = computeStandings(g); // sorted by total desc
  const lastLogin = g.lastLogin || {};
  const fmtLogin = (ts) => {
    if (!ts) return "never logged in";
    const d = new Date(ts);
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
    return d.toLocaleString(undefined, { month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit" });
  };

  return (
    <>
      <Header title={g.name} onBack={onBack}
        sub={`${rows.length} players · ${g.mode === "inperson" ? "in-person" : "remote"}`} />
      {rows.map((r, i) => (
        <div key={r.id} style={{ ...card, marginBottom: 8, padding: "12px 14px",
          display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, width: 24, textAlign: "center",
            color: i === 0 ? S.accent : S.ink, opacity: i === 0 ? 1 : 0.4 }}>
            {i + 1}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{r.name}</div>
            <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>
              {fmtLogin(lastLogin[r.id])}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 800, fontSize: 20, fontVariantNumeric: "tabular-nums",
              color: r.total < 0 ? "#ff8095" : S.ink }}>{r.total}</div>
            <div style={{ fontSize: 10.5, opacity: 0.45 }}>points</div>
          </div>
        </div>
      ))}
    </>
  );
}

/* ---------- Admin: ONE shared score screen for the whole tournament ----------
   Lists every match once. Entering goals sets a shared result that every group
   reads. Group-stage ties are draws; knockout ties prompt for a penalty winner. */
function AdminAllScores({ onBack }) {
  const results = useSharedResults();
  const [koGames, setKoGames] = useState([]); // admin-added knockout games (shared sandbox-local)
  const [stageFilter, setStageFilter] = useState("group");

  const groupFix = useMemo(groupStageFixtures, []);
  const knownKo = knockoutFixtures(stageFilter);
  const allGames = stageFilter === "group"
    ? groupFix
    : knownKo.length > 0
      ? knownKo // known bracket (R32) — list directly, like the group stage
      : koGames.filter((k) => k.stage === stageFilter); // R16+ still manually added

  // knockout adder
  const [koHome, setKoHome] = useState("");
  const [koAway, setKoAway] = useState("");
  const koStage = stageFilter === "group" ? "r32" : stageFilter;

  async function setGoals(game, h, a) {
    const hg = h === "" ? null : Math.max(0, parseInt(h, 10) || 0);
    const ag = a === "" ? null : Math.max(0, parseInt(a, 10) || 0);
    if (hg == null || ag == null) {
      // incomplete — clear the result
      await RESULTS.set(game.id, null);
      return;
    }
    let w;
    if (hg > ag) w = game.home;
    else if (ag > hg) w = game.away;
    else w = game.stage === "group" ? "DRAW" : "PEN"; // knockout tie -> needs penalty winner
    await RESULTS.set(game.id, { h: hg, a: ag, w });
  }
  async function setPenWinner(game, team, penH, penA) {
    const res = results[game.id];
    if (!res || typeof res === "string") return;
    const next = { ...res, w: team, pen: true };
    // optional shootout tally (display only; doesn't change who advanced)
    const ph = penH === "" || penH == null ? undefined : Math.max(0, parseInt(penH, 10) || 0);
    const pa = penA === "" || penA == null ? undefined : Math.max(0, parseInt(penA, 10) || 0);
    if (ph != null && pa != null) { next.ph = ph; next.pa = pa; }
    await RESULTS.set(game.id, next);
  }
  function addKo() {
    if (!koHome || !koAway || koHome === koAway) return;
    setKoGames((ks) => [...ks, { id: `ko-${uid()}`, stage: stageFilter, home: koHome, away: koAway }]);
    setKoHome(""); setKoAway("");
  }

  const stages = [["group", "Groups"], ["r32", "R32"], ["r16", "R16"],
    ["qf", "QF"], ["sf", "SF"], ["final", "Final"]];

  return (
    <>
      <Header title="Enter scores" onBack={onBack}
        sub="One scoreboard for everyone — a result here updates every group." />

      <div style={{ display: "flex", gap: 5, marginBottom: 14, flexWrap: "wrap" }}>
        {stages.map(([k, l]) => (
          <button key={k} onClick={() => setStageFilter(k)}
            className={stageFilter === k ? "tab on" : "tab"}
            style={{ fontSize: 12.5, padding: "8px 10px", flex: "0 0 auto" }}>{l}</button>
        ))}
      </div>

      {stageFilter !== "group" && knownKo.length === 0 && (
        <div style={{ ...card, marginBottom: 14, padding: "12px 14px" }}>
          <div style={{ ...lbl, marginBottom: 8 }}>Add a {stageLabelG(stageFilter)} match</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <select className="inp" value={koHome} onChange={(e) => setKoHome(e.target.value)}
              style={{ flex: 1, minWidth: 120 }}>
              <option value="">Home…</option>
              {ALL_TEAMS.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
            <select className="inp" value={koAway} onChange={(e) => setKoAway(e.target.value)}
              style={{ flex: 1, minWidth: 120 }}>
              <option value="">Away…</option>
              {ALL_TEAMS.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
            <button className="primary" onClick={addKo} style={{ padding: "8px 14px" }}>Add</button>
          </div>
        </div>
      )}

      {allGames.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "28px 16px" }}>
          <p style={{ opacity: 0.6, margin: 0 }}>
            {stageFilter === "group" ? "No fixtures."
              : `${stageLabelG(stageFilter)} matchups aren't set yet — they depend on earlier results.`}
          </p>
        </div>
      ) : allGames.map((game) => (
        <AdminScoreRow key={game.id} game={game} res={results[game.id]}
          onGoals={setGoals} onPenWinner={setPenWinner} />
      ))}
    </>
  );
}

function stageLabelG(k) { return STAGES.find((s) => s.key === k)?.label || k; }

/* A single match row on the shared admin screen: two goal inputs, derived
   winner, and a penalty-winner picker for level knockout games. */
function AdminScoreRow({ game, res, onGoals, onPenWinner }) {
  const obj = res && typeof res === "object" ? res : null;
  const [h, setH] = useState(obj && obj.h != null ? String(obj.h) : "");
  const [a, setA] = useState(obj && obj.a != null ? String(obj.a) : "");
  const [penH, setPenH] = useState(obj && obj.ph != null ? String(obj.ph) : "");
  const [penA, setPenA] = useState(obj && obj.pa != null ? String(obj.pa) : "");
  // keep local inputs in sync if another device changes the score
  useEffect(() => {
    const o = res && typeof res === "object" ? res : null;
    setH(o && o.h != null ? String(o.h) : "");
    setA(o && o.a != null ? String(o.a) : "");
    setPenH(o && o.ph != null ? String(o.ph) : "");
    setPenA(o && o.pa != null ? String(o.pa) : "");
  }, [res]);

  const w = winnerOf(res);
  const drawn = isDraw(res);
  const needsPen = obj && obj.w === "PEN";
  const goalInput = (val, set, onCommit, w0 = 52) => (
    <input className="inp" inputMode="numeric" value={val}
      onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 2); set(v); }}
      onBlur={onCommit} placeholder="–"
      style={{ width: w0, textAlign: "center", fontWeight: 800, fontSize: 18, padding: "8px 4px" }} />
  );

  return (
    <div style={{ ...card, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11, opacity: 0.45, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.08em" }}>
          {stageLabelG(game.stage)}{game.group ? ` · Group ${game.group}` : ""}
        </span>
        {(game.day && game.time) && <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 600 }}>
          {fmtWhen(game)}</span>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{FLAG[game.home]}</span>
          <span style={{ fontWeight: w === game.home ? 800 : 600, fontSize: 14 }}>{game.home}</span>
        </div>
        {goalInput(h, setH, () => onGoals(game, h, a))}
        <span style={{ opacity: 0.4, fontWeight: 700 }}>–</span>
        {goalInput(a, setA, () => onGoals(game, h, a))}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
          <span style={{ fontWeight: w === game.away ? 800 : 600, fontSize: 14 }}>{game.away}</span>
          <span style={{ fontSize: 18 }}>{FLAG[game.away]}</span>
        </div>
      </div>

      {/* status line */}
      <div style={{ marginTop: 8, fontSize: 12.5, textAlign: "center" }}>
        {needsPen ? (
          <div>
            <div style={{ color: "#ffd166", fontWeight: 700, marginBottom: 6 }}>
              Level after 90 — penalty shootout
            </div>
            {/* optional tally */}
            <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center",
              marginBottom: 8 }}>
              <span style={{ fontSize: 11, opacity: 0.6 }}>Pens:</span>
              {goalInput(penH, setPenH, () => {}, 40)}
              <span style={{ opacity: 0.4, fontWeight: 700 }}>–</span>
              {goalInput(penA, setPenA, () => {}, 40)}
            </div>
            <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 6 }}>Tap the team that won:</div>
            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
              {[game.home, game.away].map((t) => (
                <button key={t} onClick={() => onPenWinner(game, t, penH, penA)}
                  className="tab" style={{ padding: "6px 12px", fontSize: 12.5 }}>{t} (pens)</button>
              ))}
            </div>
          </div>
        ) : drawn ? (
          <span style={{ color: "#9fb0d0", fontWeight: 700 }}>Draw</span>
        ) : w ? (
          <span style={{ color: S.winB, fontWeight: 700 }}>
            {w} win{obj && obj.pen ? (obj.ph != null && obj.pa != null
              ? ` (pens ${obj.ph}–${obj.pa})` : " (pens)") : ""}
          </span>
        ) : (
          <span style={{ opacity: 0.4 }}>Enter goals to record this match</span>
        )}
      </div>
    </div>
  );
}

/* ---------- Player login by phone ---------- */
function PlayerLogin({ onBack, onFound, inviteId }) {
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteName, setInviteName] = useState("");

  // If we arrived via an invite link, look up the group name to greet them.
  useEffect(() => {
    if (!inviteId) return;
    (async () => {
      const g = await STORAGE.get(groupKey(inviteId));
      if (g) setInviteName(g.name);
    })();
  }, [inviteId]);

  async function go() {
    setBusy(true); setErr("");
    const np = normPhone(phone);
    if (np.length < 7) { setErr("Enter the phone number your organizer used."); setBusy(false); return; }
    // Invite link: check that group first.
    if (inviteId) {
      const g = await STORAGE.get(groupKey(inviteId));
      if (g && g.players.some((p) => normPhone(p.phone) === np)) {
        setBusy(false); onFound(np); return;
      }
    }
    const idx = (await STORAGE.get(INDEX_KEY)) || [];
    let found = false;
    for (const entry of idx) {
      const g = await STORAGE.get(groupKey(entry.id));
      if (g && g.players.some((p) => normPhone(p.phone) === np)) { found = true; break; }
    }
    setBusy(false);
    if (found) onFound(np);
    else setErr(inviteId
      ? "That number isn't on this group's player list. Check with your organizer."
      : "No groups found for that number. Check with your organizer.");
  }

  return (
    <>
      <Header title={inviteName ? `Join ${inviteName}` : "Player login"} onBack={onBack}
        sub="Enter the phone number your organizer used for you." />
      {inviteName && (
        <div style={{ ...card, marginBottom: 14, borderColor: S.accent, display: "flex",
          gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 18 }}>🎟️</span>
          <span style={{ fontSize: 14 }}>You've been invited to <strong>{inviteName}</strong>.</span>
        </div>
      )}
      <label style={lbl}>Phone number</label>
      <input className="inp" inputMode="tel" placeholder="(555) 123-4567"
        value={phone} onChange={(e) => setPhone(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && go()} />
      {err && <p style={{ color: "#ff8095", fontSize: 13, marginTop: 8 }}>{err}</p>}
      <button className="primary" disabled={busy} onClick={go}
        style={{ width: "100%", marginTop: 16, opacity: busy ? 0.5 : 1 }}>
        {busy ? "Looking…" : "Continue"}
      </button>
    </>
  );
}

/* ---------- Player: pick which group to view ---------- */
function PlayerGroups({ phone, onBack, onOpen }) {
  const [mine, setMine] = useState(null);
  useEffect(() => {
    (async () => {
      const idx = (await STORAGE.get(INDEX_KEY)) || [];
      const out = [];
      for (const entry of idx) {
        const g = await STORAGE.get(groupKey(entry.id));
        const me = g && g.players.find((p) => normPhone(p.phone) === phone);
        if (me) out.push({ id: g.id, name: g.name, me, players: g.players.length,
          drafted: g.picks.length === ALL_TEAMS.length });
      }
      setMine(out);
    })();
  }, [phone]);

  if (!mine) return <Spinner />;
  return (
    <>
      <Header title="Your groups" onBack={onBack}
        sub={mine.length ? "Pick one to view." : undefined} />
      {mine.length === 0 ? (
        <div style={{ ...card, textAlign: "center" }}>
          <p style={{ opacity: 0.7 }}>You're not in any groups yet.</p>
        </div>
      ) : mine.map((g) => (
        <button key={g.id} onClick={() => onOpen(g.id)} className="row-card">
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{g.name}</div>
            <div style={{ opacity: 0.5, fontSize: 13, marginTop: 2 }}>
              Playing as {g.me.name} · {g.drafted ? "live" : "drafting"}
            </div>
          </div>
          <span style={{ opacity: 0.4 }}>→</span>
        </button>
      ))}
    </>
  );
}

/* ---------- Shell / shared UI ---------- */
function Shell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: S.bg, color: S.ink,
      fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{globalCSS}</style>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px 48px" }}>
        {children}
      </div>
    </div>
  );
}
function Spinner() {
  return <div style={{ padding: 80, textAlign: "center", opacity: 0.6 }}>Loading…</div>;
}
function Header({ title, sub, onBack, right }) {
  return (
    <header style={{ paddingTop: 24, paddingBottom: 16, display: "flex",
      alignItems: "flex-start", gap: 12 }}>
      {onBack && (
        <button onClick={onBack} className="ghost" style={{ marginTop: 4 }}>←</button>
      )}
      <div style={{ flex: 1 }}>
        <h1 style={{ font: "800 26px/1.05 'Space Grotesk', sans-serif",
          letterSpacing: "-0.02em", margin: 0 }}>{title}</h1>
        {sub && <div style={{ margin: "6px 0 0", opacity: 0.55, fontSize: 14 }}>{sub}</div>}
      </div>
      {right}
    </header>
  );
}

/* ---------- Home: list of draft groups ---------- */
function Home({ index, onOpen, onNew, onExit, onDelete }) {
  const [confirmId, setConfirmId] = useState(null);
  const confirmGroup = index.find((g) => g.id === confirmId);
  return (
    <>
      <header style={{ paddingTop: 32, paddingBottom: 20, display: "flex",
        alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase",
            color: S.accent, fontWeight: 700 }}>Organizer</div>
          <h1 style={{ font: "800 34px/1 'Space Grotesk', sans-serif",
            letterSpacing: "-0.03em", margin: "8px 0 0" }}>Draft Room</h1>
          <p style={{ opacity: 0.55, fontSize: 14, marginTop: 10 }}>
            Create groups, run the draft, log results.
          </p>
        </div>
        {onExit && <button className="ghost" onClick={onExit} style={{ marginTop: 4 }}>Exit</button>}
      </header>

      {index.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "40px 24px" }}>
          <div style={{ fontSize: 40 }}>🏆</div>
          <p style={{ opacity: 0.7, margin: "12px 0 0" }}>No draft groups yet.</p>
          <p style={{ opacity: 0.45, fontSize: 13, margin: "4px 0 0" }}>
            Make one for family, friends, or work.
          </p>
        </div>
      ) : (
        index.map((g) => (
          <div key={g.id} className="row-card" style={{ padding: 0, overflow: "hidden" }}>
            <button onClick={() => onOpen(g.id)}
              style={{ flex: 1, display: "flex", alignItems: "center",
                justifyContent: "space-between", background: "transparent", border: "none",
                color: "inherit", font: "inherit", cursor: "pointer", padding: 16, textAlign: "left" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{g.name}</div>
                <div style={{ opacity: 0.5, fontSize: 13, marginTop: 2 }}>
                  {g.players} players · {g.phase}
                </div>
              </div>
              <span style={{ opacity: 0.4 }}>→</span>
            </button>
            <button onClick={() => setConfirmId(g.id)} title="Delete group"
              style={{ background: "transparent", border: "none", borderLeft: "1px solid #222d47",
                color: "#ff8095", cursor: "pointer", padding: "0 16px", fontSize: 16,
                alignSelf: "stretch" }}>🗑</button>
          </div>
        ))
      )}

      <button onClick={onNew} className="primary" style={{ marginTop: 16, width: "100%" }}>
        + New draft group
      </button>

      {confirmGroup && (
        <div className="modal-bg" onClick={() => setConfirmId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: "none" }}>
            <h2 style={{ font: "800 20px 'Space Grotesk', sans-serif", margin: "0 0 8px" }}>
              Delete "{confirmGroup.name}"?
            </h2>
            <p style={{ opacity: 0.65, fontSize: 14, lineHeight: 1.5, margin: "0 0 18px" }}>
              This permanently removes the group, its draft, and all results. This can't
              be undone.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ghost" onClick={() => setConfirmId(null)}
                style={{ flex: 1, padding: 14 }}>Cancel</button>
              <button onClick={async () => { const id = confirmId; setConfirmId(null); await onDelete(id); }}
                style={{ flex: 1, padding: 14, borderRadius: 14, border: "none",
                  background: "#ff8095", color: "#0b1020", fontWeight: 800, fontSize: 15,
                  cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- New group setup ---------- */
function NewGroup({ onCancel, onCreated }) {
  const [name, setName] = useState("");
  const [players, setPlayers] = useState([{ id: uid(), name: "", phone: "" }]);
  const [organizerId, setOrganizerId] = useState(null); // which player is "me"
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [mode, setMode] = useState("remote"); // remote | inperson
  const [when, setWhen] = useState("now"); // now | scheduled
  const [startAt, setStartAt] = useState(""); // ISO local datetime
  const [busy, setBusy] = useState(false);

  const setP = (i, k, v) =>
    setPlayers((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const addP = () => setPlayers((ps) => [...ps, { id: uid(), name: "", phone: "" }]);
  const rmP = (i) => setPlayers((ps) => {
    const removed = ps[i];
    if (removed && removed.id === organizerId) setOrganizerId(null);
    return ps.filter((_, j) => j !== i);
  });

  const valid = name.trim() && players.filter((p) => p.name.trim()).length >= 2
    && !(mode === "remote" && when === "scheduled" && !startAt);

  async function create() {
    setBusy(true);
    const clean = players.filter((p) => p.name.trim())
      .map((p) => ({ ...p, name: p.name.trim(), phone: p.phone.trim() }));
    // Random draft order: shuffle player indices, then snake through them.
    const shuffled = shuffledIndices(clean.length);
    const order = snakeOrderFrom(shuffled, ALL_TEAMS.length);
    const id = uid();
    const scheduledStart = mode === "remote" && when === "scheduled"
      ? new Date(startAt).getTime() : null;
    // Keep organizerId only if that player survived the cleanup.
    const orgValid = clean.some((p) => p.id === organizerId) ? organizerId : null;
    const group = {
      id, name: name.trim(), players: clean, points: { ...DEFAULT_POINTS }, theme,
      mode, scheduledStart, organizerId: orgValid,
      accepted: {}, // playerId -> timestamp accepted (remote only)
      started: mode === "inperson",
      inPersonReady: false, // one-time rules gate for in-person
      inPersonTurnReady: false, // per-turn tap-to-start gate for in-person
      order, pickIdx: 0, picks: [], // picks: {team, group, playerId, secs, at}
      results: {}, // matchId -> winner team name
      rivals: {}, // playerId -> rival playerId
      draftTime: {}, // playerId -> total seconds spent drafting
      seenRules: {}, // playerId -> true once they've passed the start gate
      draftReady: {}, // playerId -> timestamp once they tap START DRAFTING
      createdAt: Date.now(), shareLink: "",
    };
    await STORAGE.set(groupKey(id), group);
    const idx = (await STORAGE.get(INDEX_KEY)) || [];
    idx.push({ id, name: group.name, players: clean.length, phase: "Setup" });
    await STORAGE.set(INDEX_KEY, idx);
    onCreated(id);
  }

  return (
    <>
      <Header title="New draft group" onBack={onCancel} />
      <label style={lbl}>Group name</label>
      <input className="inp" placeholder="e.g. Baker Family"
        value={name} onChange={(e) => setName(e.target.value)} />

      <div style={{ ...lbl, marginTop: 24 }}>Players</div>
      <p style={{ fontSize: 12, opacity: 0.5, margin: "0 0 10px", lineHeight: 1.5 }}>
        Draft order is randomized when you create the group. Check "This is me" on your
        own row so you can also play.
      </p>
      {players.map((p, i) => {
        const isMe = p.id === organizerId;
        return (
          <div key={p.id} style={{ ...card, padding: 12, marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="inp" style={{ flex: 1.3 }} placeholder="Name"
                value={p.name} onChange={(e) => setP(i, "name", e.target.value)} />
              <input className="inp" style={{ flex: 1 }} placeholder="Phone (optional)"
                value={p.phone} onChange={(e) => setP(i, "phone", e.target.value)} />
              {players.length > 1 && (
                <button className="ghost" onClick={() => rmP(i)} style={{ width: 40 }}>✕</button>
              )}
            </div>
            <button onClick={() => setOrganizerId(isMe ? null : p.id)}
              disabled={!p.name.trim()}
              style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8,
                background: "transparent", border: "none", cursor: p.name.trim() ? "pointer" : "default",
                color: isMe ? S.accent : S.ink, opacity: p.name.trim() ? 1 : 0.4,
                fontFamily: "inherit", fontSize: 13, padding: 0 }}>
              <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                border: `2px solid ${isMe ? S.accent : "#3a4566"}`,
                background: isMe ? S.accent : "transparent",
                display: "grid", placeItems: "center", color: "#0b1020",
                fontSize: 12, fontWeight: 800 }}>{isMe ? "✓" : ""}</span>
              <span style={{ fontWeight: isMe ? 700 : 500 }}>This is me (the organizer)</span>
            </button>
          </div>
        );
      })}
      <button className="ghost" onClick={addP} style={{ width: "100%", marginTop: 4 }}>
        + Add player
      </button>

      <div style={{ ...lbl, marginTop: 24 }}>Pick a scoring twist</div>
      {Object.entries(THEMES).map(([key, t]) => (
        <button key={key} onClick={() => setTheme(key)} className="theme-card"
          style={{ borderColor: theme === key ? S.accent : "#222d47",
            background: theme === key ? S.card2 : S.card }}>
          <div style={{ width: 22, height: 22, borderRadius: 999, flexShrink: 0,
            border: `2px solid ${theme === key ? S.accent : "#3a4566"}`,
            display: "grid", placeItems: "center", marginTop: 1 }}>
            {theme === key && <span style={{ width: 11, height: 11, borderRadius: 999,
              background: S.accent, display: "block" }} />}
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{t.label}</div>
            <div style={{ fontSize: 13, opacity: 0.6, marginTop: 2, lineHeight: 1.4 }}>{t.blurb}</div>
          </div>
        </button>
      ))}
      <p style={{ fontSize: 12, opacity: 0.45, marginTop: 8, lineHeight: 1.5 }}>
        Base points per win: group 1, R32 2, R16 3, QF 5, SF 8, final 13.
        Smaller rosters earn more per win (scaled by 48 ÷ teams owned).
      </p>

      <div style={{ ...lbl, marginTop: 24 }}>How will you draft?</div>
      <button onClick={() => setMode("remote")} className="theme-card"
        style={{ borderColor: mode === "remote" ? S.accent : "#222d47",
          background: mode === "remote" ? S.card2 : S.card }}>
        <Radio on={mode === "remote"} />
        <div style={{ textAlign: "left" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Everyone on their own phone</div>
          <div style={{ fontSize: 13, opacity: 0.6, marginTop: 2, lineHeight: 1.4 }}>
            Players get invited, accept, and draft remotely
          </div>
        </div>
      </button>
      <button onClick={() => setMode("inperson")} className="theme-card"
        style={{ borderColor: mode === "inperson" ? S.accent : "#222d47",
          background: mode === "inperson" ? S.card2 : S.card }}>
        <Radio on={mode === "inperson"} />
        <div style={{ textAlign: "left" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>In person, one phone</div>
          <div style={{ fontSize: 13, opacity: 0.6, marginTop: 2, lineHeight: 1.4 }}>
            Your phone is passed around the room — no invites
          </div>
        </div>
      </button>

      {mode === "remote" && (
        <>
          <div style={{ ...lbl, marginTop: 18 }}>When does the draft start?</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button onClick={() => setWhen("now")}
              className={when === "now" ? "chip on" : "chip"}
              style={{ flex: 1, padding: "10px" }}>Now</button>
            <button onClick={() => setWhen("scheduled")}
              className={when === "scheduled" ? "chip on" : "chip"}
              style={{ flex: 1, padding: "10px" }}>Schedule a time</button>
          </div>
          {when === "now" && (
            <p style={{ fontSize: 12, opacity: 0.5, lineHeight: 1.5 }}>
              You'll invite players next. The draft begins when you launch it and
              enough players have accepted.
            </p>
          )}
          {when === "scheduled" && (
            <>
              <input className="inp" type="datetime-local"
                value={startAt} onChange={(e) => setStartAt(e.target.value)} />
              <p style={{ fontSize: 12, opacity: 0.5, marginTop: 6, lineHeight: 1.5 }}>
                Players are invited now and can accept anytime before the draft opens
                automatically at this time.
              </p>
            </>
          )}
        </>
      )}

      <button className="primary" disabled={!valid || busy} onClick={create}
        style={{ width: "100%", marginTop: 24, opacity: valid && !busy ? 1 : 0.4 }}>
        {busy ? "Creating…" : mode === "inperson" ? "Create & draft" : "Create & invite"}
      </button>
      {!valid && (
        <p style={{ fontSize: 12, opacity: 0.5, textAlign: "center", marginTop: 8 }}>
          {mode === "remote" && when === "scheduled" && !startAt
            ? "Pick a start date and time."
            : "Add a name and at least two players to begin."}
        </p>
      )}
    </>
  );
}

function Radio({ on }) {
  return (
    <div style={{ width: 22, height: 22, borderRadius: 999, flexShrink: 0,
      border: `2px solid ${on ? S.accent : "#3a4566"}`,
      display: "grid", placeItems: "center", marginTop: 1 }}>
      {on && <span style={{ width: 11, height: 11, borderRadius: 999,
        background: S.accent, display: "block" }} />}
    </div>
  );
}

/* Organizer-as-player control: jump into your own player view */
function OrganizerPlayBar({ g, onPlay }) {
  const me = g.players.find((p) => p.id === g.organizerId);
  if (!me) return (
    <div style={{ ...card, marginBottom: 14, fontSize: 13, opacity: 0.7 }}>
      You didn't mark which player is you. To also play, recreate the group and check
      "This is me" on your own row.
    </div>
  );
  return (
    <div style={{ ...card, marginBottom: 14, borderColor: S.accent }}>
      <div style={{ ...lbl, marginBottom: 6 }}>You're the organizer</div>
      <p style={{ fontSize: 13, opacity: 0.65, margin: "0 0 10px", lineHeight: 1.5 }}>
        Watch acceptances and results here. Tap in as a player anytime to draft and
        track your own roster.
      </p>
      <button className="primary" onClick={() => onPlay(me.id)} style={{ width: "100%" }}>
        Play as {me.name}
      </button>
    </div>
  );
}

/* ---------- Group view (tabs: Draft / Matchups / Standings) ---------- */
function GroupView({ id, onBack, onPlayAs }) {
  const [tab, setTab] = useState("draft");
  const [history, setHistory] = useState(false);
  const { g, notFound, save, patch } = usePolledGroup(id);

  if (notFound) return (
    <div style={{ ...card, textAlign: "center", marginTop: 32 }}>
      <div style={{ fontSize: 30 }}>🤔</div>
      <p style={{ opacity: 0.7, margin: "12px 0" }}>Couldn't load this group.</p>
      <button className="primary" onClick={onBack}>Back to all groups</button>
    </div>
  );
  if (!g) return <Spinner />;
  const drafting = g.picks.length < ALL_TEAMS.length;

  return (
    <>
      <Header title={g.name} onBack={onBack}
        sub={drafting ? `Pick ${g.picks.length + 1} of ${ALL_TEAMS.length}` : "All teams drafted"}
        right={<button className="ghost" onClick={() => setHistory(true)}
          style={{ marginTop: 4, fontSize: 13 }}>Draft log</button>} />

      {/* Organizer-as-player: only for remote drafts (in-person is one shared phone) */}
      {g.mode !== "inperson" && (
        <OrganizerPlayBar g={g} onPlay={(playerId) => onPlayAs(playerId)} />
      )}

      <nav style={{ display: "flex", gap: 5, marginBottom: 18 }}>
        {[["draft", "Draft"], ["matchups", "Matchups"],
          ["competition", "Competition"], ["standings", "Standings"]]
          .map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={tab === k ? "tab on" : "tab"}
              style={{ fontSize: 12.5, padding: "10px 3px" }}>{l}</button>
          ))}
      </nav>
      {tab === "draft" && (
        draftIsOpen(g)
          ? (g.mode === "inperson"
              ? <DraftTab g={g} save={save} patch={patch} />
              : <DraftBoard g={g} save={save} patch={patch} canPick={false} spectating />)
          : <AdminLobby g={g} save={save} patch={patch} />
      )}
      {tab === "matchups" && <MatchupsTab g={g} save={save} patch={patch} />}
      {tab === "competition" && <PlayerRivals g={g} meId={null} />}
      {tab === "standings" && <StandingsTab g={g} />}
      {history && <DraftHistory g={g} onClose={() => setHistory(false)} />}
    </>
  );
}

/* ---------- Shareable invite link ---------- */
function InviteLink({ g }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/?g=${g.id}` : "";

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${g.name} — Jingo`,
          text: `Join my World Cup draft "${g.name}"`, url });
        return;
      }
    } catch (e) { /* fall through to copy */ }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch (e) { /* clipboard blocked; user can long-press the text */ }
  }

  return (
    <div style={{ ...card, marginBottom: 14, borderColor: S.accent }}>
      <div style={{ ...lbl, marginBottom: 6 }}>Invite your players</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1, fontSize: 12.5, opacity: 0.7, background: S.card2,
          borderRadius: 9, padding: "9px 11px", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</div>
        <button className="primary" onClick={share}
          style={{ padding: "9px 14px", fontSize: 14 }}>
          {copied ? "Copied!" : "Share"}
        </button>
      </div>
      <p style={{ fontSize: 12, opacity: 0.5, margin: "8px 0 0", lineHeight: 1.5 }}>
        Send this link to your players. They open it, enter the phone number you used
        for them, and they're in. They can only join if their number is on your player list.
      </p>
    </div>
  );
}

/* ---------- Admin pre-draft lobby (remote) / rules gate (in-person) ---------- */
function AdminLobby({ g, save, patch }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!g.scheduledStart) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [g.scheduledStart]);

  if (g.mode === "inperson") {
    const theme = THEMES[g.theme] || THEMES[DEFAULT_THEME];
    return (
      <div style={{ ...card }}>
        <h2 style={{ font: "800 22px 'Space Grotesk', sans-serif", margin: "0 0 10px" }}>
          In-person draft
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.55, opacity: 0.8, margin: "0 0 12px" }}>
          Pass this phone around the room. Before each turn, the player on the clock taps
          to start — <strong>the pick clock only runs while the phone is in their hands</strong>.
          Fastest total picker earns +{RIVAL.speedFastest}, slowest loses {Math.abs(RIVAL.speedSlowest)}.
        </p>
        <div style={{ ...lbl }}>Draft order (randomized)</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {g.order.slice(0, g.players.length).map((pi, i) => (
            <span key={i} style={{ fontSize: 12.5, padding: "5px 10px", borderRadius: 999,
              background: i === 0 ? S.accent : S.card2,
              color: i === 0 ? "#0b1020" : S.ink,
              fontWeight: i === 0 ? 800 : 600 }}>
              {i + 1}. {g.players[pi]?.name}
            </span>
          ))}
        </div>
        <p style={{ fontSize: 12, opacity: 0.5, margin: "-6px 0 14px" }}>
          Snake order — it reverses each round, so the last picker goes back-to-back.
        </p>
        <div style={{ ...lbl }}>Twist · {theme.label}</div>
        <p style={{ fontSize: 13, opacity: 0.65, margin: "0 0 16px" }}>{theme.blurb}</p>
        <button className="primary" style={{ width: "100%" }}
          onClick={() => patch({ op: "inPersonReady" })}>
          Start draft →
        </button>
      </div>
    );
  }

  const accepted = g.accepted || {};
  const order = Object.entries(accepted).sort((a, b) => a[1] - b[1]).map(([pid]) => pid);
  const acceptedCount = order.length;
  const enoughToStart = acceptedCount >= 2;
  const countdown = g.scheduledStart ? g.scheduledStart - Date.now() : null;

  async function launch() { await patch({ op: "launch" }); }

  return (
    <>
      <InviteLink g={g} />
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ ...lbl, marginBottom: 4 }}>
          {g.scheduledStart ? "Scheduled draft" : "Draft lobby"}
        </div>
        {countdown != null && countdown > 0 ? (
          <>
            <div style={{ font: "800 26px 'Space Grotesk', sans-serif",
              fontVariantNumeric: "tabular-nums" }}>{fmtCountdown(countdown)}</div>
            <p style={{ fontSize: 13, opacity: 0.55, margin: "4px 0 0" }}>
              opens {fmtDateTime(g.scheduledStart)} — or launch early below
            </p>
          </>
        ) : (
          <p style={{ fontSize: 14, opacity: 0.7, margin: 0 }}>
            {g.scheduledStart ? "Start time reached." : "Launch when your players are in."}
          </p>
        )}
      </div>

      <div style={lbl}>Accepted · {acceptedCount}/{g.players.length}</div>
      {g.players.map((p) => {
        const pos = order.indexOf(p.id);
        const yes = pos !== -1;
        const isLast = yes && pos === order.length - 1 && acceptedCount >= 2;
        return (
          <div key={p.id} style={{ ...card, padding: "10px 14px", marginBottom: 6,
            display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>{yes ? "✅" : "⬜"}</span>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 14,
              opacity: yes ? 1 : 0.5 }}>{p.name}</span>
            {yes
              ? <span style={{ fontSize: 11, opacity: 0.45 }}>
                  #{pos + 1}{isLast ? " · last so far" : ""}</span>
              : <span style={{ fontSize: 11, opacity: 0.4 }}>not yet</span>}
          </div>
        );
      })}

      <button className="primary" disabled={!enoughToStart} onClick={launch}
        style={{ width: "100%", marginTop: 14, opacity: enoughToStart ? 1 : 0.4 }}>
        Launch draft now
      </button>
      {!enoughToStart && (
        <p style={{ fontSize: 12, opacity: 0.5, textAlign: "center", marginTop: 8 }}>
          At least two players need to accept first.
        </p>
      )}
      <p style={{ fontSize: 12, opacity: 0.45, textAlign: "center", marginTop: 8, lineHeight: 1.5 }}>
        The last player to accept loses a point.
      </p>
    </>
  );
}

/* ---------- Draft board (shared by admin in-person and player remote) ---------- */
/* Live draft top bar: last pick · who's drafting now (+timer) · who's next. */
function DraftTopBar({ g, curPlayer, curPlayerIdx, elapsed, canPick }) {
  const pname = (pid) => g.players.find((p) => p.id === pid)?.name || "—";
  const lastPick = g.picks.length > 0 ? g.picks[g.picks.length - 1] : null;
  const nextIdx = g.order[g.pickIdx + 1];
  const nextPlayer = nextIdx != null ? g.players[nextIdx] : null;
  const cell = { flex: 1, textAlign: "center", padding: "2px 4px", minWidth: 0 };
  const capLabel = { fontSize: 9.5, opacity: 0.5, textTransform: "uppercase",
    letterSpacing: "0.08em", marginBottom: 4 };
  return (
    <div style={{ ...card, padding: "12px 8px", display: "flex", alignItems: "stretch",
      borderColor: canPick ? S.accent : "#222d47" }}>
      {/* Last pick */}
      <div style={cell}>
        <div style={capLabel}>Last pick</div>
        {lastPick ? (
          <>
            <div style={{ fontSize: 20 }}>{FLAG[lastPick.team]}</div>
            <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 2, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lastPick.team}</div>
            <div style={{ fontSize: 10, opacity: 0.55, marginTop: 1 }}>{pname(lastPick.playerId)}</div>
          </>
        ) : <div style={{ fontSize: 12, opacity: 0.4, marginTop: 8 }}>—</div>}
      </div>

      <div style={{ width: 1, background: "#222d47", margin: "2px 4px" }} />

      {/* On the clock */}
      <div style={{ ...cell, flex: 1.2 }}>
        <div style={{ ...capLabel, color: canPick ? S.accent : undefined,
          opacity: canPick ? 0.9 : 0.5 }}>
          {canPick ? "You're up" : "Drafting"}
        </div>
        <div style={{ fontWeight: 800, fontSize: 15, overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{curPlayer?.name || "—"}</div>
        <div style={{ fontWeight: 800, fontSize: 20, marginTop: 2, fontVariantNumeric: "tabular-nums",
          color: elapsed >= 60 ? "#ff8095" : S.accent }}>{fmtClock(elapsed)}</div>
      </div>

      <div style={{ width: 1, background: "#222d47", margin: "2px 4px" }} />

      {/* Up next */}
      <div style={cell}>
        <div style={capLabel}>Up next</div>
        {nextPlayer ? (
          <>
            <div style={{ width: 30, height: 30, borderRadius: 9, margin: "0 auto",
              background: S.card2, display: "grid", placeItems: "center", fontWeight: 800,
              fontSize: 13 }}>{nextPlayer.name[0].toUpperCase()}</div>
            <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 4, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nextPlayer.name}</div>
          </>
        ) : <div style={{ fontSize: 11, opacity: 0.4, marginTop: 8 }}>last pick</div>}
      </div>
    </div>
  );
}

function DraftBoard({ g, save, patch, canPick, spectating, ackedAt }) {
  const [stageFilter, setStageFilter] = useState("all");
  const taken = useMemo(() => new Set(g.picks.map((p) => p.team)), [g.picks]);
  const done = g.picks.length >= ALL_TEAMS.length;
  const curPlayerIdx = done ? null : g.order[g.pickIdx];
  const curPlayer = curPlayerIdx != null ? g.players[curPlayerIdx] : null;

  const rosterCount = (pid) => g.picks.filter((p) => p.playerId === pid).length;

  // Per-turn live clock. Reset whenever the pick index changes.
  // Remote: the clock starts when the player tapped "I'm up" (ackedAt). That tap
  // is what advances them past the YOU'RE UP gate, so timing is fair — it only
  // counts the time they actually spent choosing, not the wait for their turn.
  // In-person: a tap-to-start gate on this screen sets the clock.
  const inPerson = g.mode === "inperson";
  const [turnStart, setTurnStart] = useState(() => ackedAt || Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [picking, setPicking] = useState(false);
  const [turnStarted, setTurnStarted] = useState(!inPerson);
  useEffect(() => {
    setTurnStarted(!inPerson);
    setTurnStart(ackedAt || Date.now());
    setNow(Date.now());
    setPicking(false);
  }, [g.pickIdx, inPerson, ackedAt]);
  useEffect(() => {
    if (done || !turnStarted) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [done, turnStarted]);
  const elapsed = turnStarted ? Math.max(0, Math.floor((now - turnStart) / 1000)) : 0;

  function startTurn() {
    setTurnStart(Date.now());
    setNow(Date.now());
    setTurnStarted(true);
  }

  // In-person tap-to-start gate before each pick.
  if (inPerson && !done && !turnStarted && canPick) {
    return (
      <div style={{ minHeight: "70vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center",
        padding: "24px 16px" }}>
        <div style={{ fontSize: 14, opacity: 0.5, textTransform: "uppercase",
          letterSpacing: "0.16em", marginBottom: 18 }}>Pass the phone to</div>
        <div style={{
          font: "800 clamp(48px, 18vw, 104px)/0.95 'Space Grotesk', sans-serif",
          letterSpacing: "-0.03em", color: S.accent, marginBottom: 6,
          wordBreak: "break-word" }}>
          {curPlayer?.name}
        </div>
        <div style={{ font: "700 clamp(20px, 6vw, 30px)/1 'Space Grotesk', sans-serif",
          opacity: 0.85, marginBottom: 28 }}>
          it's your turn
        </div>
        <p style={{ opacity: 0.5, fontSize: 13.5, margin: "0 0 28px", lineHeight: 1.5,
          maxWidth: 320 }}>
          Pick {g.picks.length + 1} of {ALL_TEAMS.length}. Your clock starts the
          moment you tap — be quick, fastest total drafter wins a point.
        </p>
        <button className="primary" onClick={startTurn}
          style={{ width: "100%", maxWidth: 360, padding: "16px",
            fontSize: 17 }}>
          Start my pick →
        </button>
      </div>
    );
  }

  async function pick(team) {
    if (taken.has(team.name) || done || !curPlayer || !canPick || picking) return;
    setPicking(true);
    const secs = Math.max(0, (Date.now() - turnStart) / 1000);
    if (patch) {
      // Atomic server-side append; the server enforces turn + not-taken.
      const updated = await patch({ op: "pick", playerId: curPlayer.id,
        team: team.name, group: team.group, secs });
      if (updated) {
        const ni = updated.order[updated.pickIdx];
        if (ni != null) NOTIFY.draftTurn(updated.players[ni], updated);
      }
    } else {
      const draftTime = { ...(g.draftTime || {}) };
      draftTime[curPlayer.id] = (draftTime[curPlayer.id] || 0) + secs;
      const next = {
        ...g,
        picks: [...g.picks, { team: team.name, group: team.group,
          playerId: curPlayer.id, secs: Math.round(secs * 10) / 10, at: Date.now() }],
        pickIdx: g.pickIdx + 1,
        draftTime,
      };
      await save(next);
      const ni = next.order[next.pickIdx];
      if (ni != null) NOTIFY.draftTurn(next.players[ni], next);
    }
    setPicking(false);
  }

  const visibleGroups = stageFilter === "all"
    ? Object.keys(GROUPS) : [stageFilter];

  return (
    <>
      {spectating && !done && (
        <div style={{ ...card, marginBottom: 12, borderColor: S.accent,
          display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 18 }}>👀</span>
          <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.4 }}>
            You're watching live. Players draft on their own phones — to make your own
            picks, tap <strong>Play as you</strong> at the top.
          </div>
        </div>
      )}
      {!done ? (
        <DraftTopBar g={g} curPlayer={curPlayer} curPlayerIdx={curPlayerIdx}
          elapsed={elapsed} canPick={canPick} />
      ) : (
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: 30 }}>✅</div>
          <div style={{ fontWeight: 700, marginTop: 6 }}>Draft complete</div>
          <div style={{ opacity: 0.5, fontSize: 13 }}>
            {canPick ? "Head to Matchups to log results." : "Check your roster and standings."}
          </div>
        </div>
      )}

      {/* roster chips */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "16px 0 8px" }}>
        {g.players.map((p, i) => (
          <span key={p.id} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 999,
            background: i === curPlayerIdx ? S.accent : S.card2,
            color: i === curPlayerIdx ? "#0b1020" : S.ink,
            fontWeight: i === curPlayerIdx ? 700 : 500 }}>
            {p.name} · {rosterCount(p.id)}
          </span>
        ))}
      </div>

      {/* group filter */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
        <button className={stageFilter === "all" ? "chip on" : "chip"}
          onClick={() => setStageFilter("all")}>All</button>
        {Object.keys(GROUPS).map((gr) => (
          <button key={gr} className={stageFilter === gr ? "chip on" : "chip"}
            onClick={() => setStageFilter(gr)}>{gr}</button>
        ))}
      </div>

      {/* team board */}
      {visibleGroups.map((gr) => (
        <div key={gr} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.4, fontWeight: 700, margin: "0 0 6px 2px" }}>
            GROUP {gr}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {GROUPS[gr].map((team) => {
              const isTaken = taken.has(team);
              const owner = g.picks.find((p) => p.team === team);
              const ownerName = owner ? g.players.find((pl) => pl.id === owner.playerId)?.name : null;
              const disabled = isTaken || done || !canPick;
              return (
                <button key={team} disabled={disabled}
                  onClick={() => pick({ name: team, group: gr })}
                  className="team-btn"
                  style={{ opacity: isTaken ? 0.4 : (canPick ? 1 : 0.7),
                    cursor: disabled ? "default" : "pointer" }}>
                  <span style={{ fontSize: 18 }}>{FLAG[team]}</span>
                  <span style={{ flex: 1, textAlign: "left", fontSize: 13.5,
                    fontWeight: 600 }}>{team}</span>
                  {isTaken && <span style={{ fontSize: 10, opacity: 0.7 }}>{ownerName}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

/* Admin draft tab — admin device can always pick (in-person pass-around). */
function DraftTab({ g, save, patch }) {
  return <DraftBoard g={g} save={save} patch={patch} canPick={true} />;
}

/* Player live draft — can only pick on their turn. */
function LiveDraft({ g, me, save, patch, onBack, myTurn, pname, ackedAt }) {
  return (
    <>
      <Header title={g.name} onBack={onBack} sub={`Playing as ${me?.name}`} />
      {!myTurn && (
        <div style={{ ...card, marginBottom: 12, textAlign: "center", borderColor: S.accent }}>
          <p style={{ fontWeight: 700, margin: 0 }}>
            Waiting for {pname(g.players[g.order[g.pickIdx]]?.id)} to pick…
          </p>
          <p style={{ opacity: 0.5, fontSize: 13, margin: "4px 0 0" }}>
            Your clock starts when you tap “I’m up” on your turn.
          </p>
        </div>
      )}
      <DraftBoard g={g} save={save} patch={patch} canPick={myTurn} ackedAt={ackedAt} />
    </>
  );
}

/* ---------- Matchups: build fixtures, log winners ---------- */
/* Group-stage round robin is generated; knockout fixtures are logged manually
   since the bracket depends on results. We surface all 72 group games. */

const GROUP_FIXTURES = [
  {m:1,g:"A",h:"Mexico",a:"South Africa",d:"2026-06-11",day:"Thu",t:"3:00 PM"},
  {m:2,g:"A",h:"South Korea",a:"Czechia",d:"2026-06-11",day:"Thu",t:"10:00 PM"},
  {m:3,g:"B",h:"Canada",a:"Bosnia and Herzegovina",d:"2026-06-12",day:"Fri",t:"3:00 PM"},
  {m:4,g:"D",h:"United States",a:"Paraguay",d:"2026-06-12",day:"Fri",t:"9:00 PM"},
  {m:8,g:"B",h:"Qatar",a:"Switzerland",d:"2026-06-13",day:"Sat",t:"3:00 PM"},
  {m:7,g:"C",h:"Brazil",a:"Morocco",d:"2026-06-13",day:"Sat",t:"6:00 PM"},
  {m:5,g:"C",h:"Haiti",a:"Scotland",d:"2026-06-13",day:"Sat",t:"9:00 PM"},
  {m:6,g:"D",h:"Australia",a:"Türkiye",d:"2026-06-13",day:"Sat",t:"12:00 AM"},
  {m:10,g:"E",h:"Germany",a:"Curaçao",d:"2026-06-14",day:"Sun",t:"1:00 PM"},
  {m:11,g:"F",h:"Netherlands",a:"Japan",d:"2026-06-14",day:"Sun",t:"4:00 PM"},
  {m:9,g:"E",h:"Ivory Coast",a:"Ecuador",d:"2026-06-14",day:"Sun",t:"7:00 PM"},
  {m:12,g:"F",h:"Sweden",a:"Tunisia",d:"2026-06-14",day:"Sun",t:"10:00 PM"},
  {m:14,g:"H",h:"Spain",a:"Cape Verde",d:"2026-06-15",day:"Mon",t:"12:00 PM"},
  {m:16,g:"G",h:"Belgium",a:"Egypt",d:"2026-06-15",day:"Mon",t:"3:00 PM"},
  {m:13,g:"H",h:"Saudi Arabia",a:"Uruguay",d:"2026-06-15",day:"Mon",t:"6:00 PM"},
  {m:15,g:"G",h:"Iran",a:"New Zealand",d:"2026-06-15",day:"Mon",t:"9:00 PM"},
  {m:17,g:"I",h:"France",a:"Senegal",d:"2026-06-16",day:"Tue",t:"3:00 PM"},
  {m:18,g:"I",h:"Iraq",a:"Norway",d:"2026-06-16",day:"Tue",t:"6:00 PM"},
  {m:19,g:"J",h:"Argentina",a:"Algeria",d:"2026-06-16",day:"Tue",t:"9:00 PM"},
  {m:20,g:"J",h:"Austria",a:"Jordan",d:"2026-06-16",day:"Tue",t:"12:00 AM"},
  {m:23,g:"K",h:"Portugal",a:"DR Congo",d:"2026-06-17",day:"Wed",t:"1:00 PM"},
  {m:21,g:"L",h:"England",a:"Croatia",d:"2026-06-17",day:"Wed",t:"4:00 PM"},
  {m:22,g:"L",h:"Ghana",a:"Panama",d:"2026-06-17",day:"Wed",t:"7:00 PM"},
  {m:24,g:"K",h:"Uzbekistan",a:"Colombia",d:"2026-06-17",day:"Wed",t:"10:00 PM"},
  {m:25,g:"A",h:"Czechia",a:"South Africa",d:"2026-06-18",day:"Thu",t:"12:00 PM"},
  {m:26,g:"B",h:"Switzerland",a:"Bosnia and Herzegovina",d:"2026-06-18",day:"Thu",t:"3:00 PM"},
  {m:27,g:"B",h:"Canada",a:"Qatar",d:"2026-06-18",day:"Thu",t:"6:00 PM"},
  {m:28,g:"A",h:"Mexico",a:"South Korea",d:"2026-06-18",day:"Thu",t:"9:00 PM"},
  {m:32,g:"D",h:"United States",a:"Australia",d:"2026-06-19",day:"Fri",t:"3:00 PM"},
  {m:30,g:"C",h:"Scotland",a:"Morocco",d:"2026-06-19",day:"Fri",t:"6:00 PM"},
  {m:29,g:"C",h:"Brazil",a:"Haiti",d:"2026-06-19",day:"Fri",t:"9:00 PM"},
  {m:31,g:"D",h:"Türkiye",a:"Paraguay",d:"2026-06-19",day:"Fri",t:"12:00 AM"},
  {m:35,g:"F",h:"Netherlands",a:"Sweden",d:"2026-06-20",day:"Sat",t:"1:00 PM"},
  {m:33,g:"E",h:"Germany",a:"Ivory Coast",d:"2026-06-20",day:"Sat",t:"4:00 PM"},
  {m:34,g:"E",h:"Ecuador",a:"Curaçao",d:"2026-06-20",day:"Sat",t:"8:00 PM"},
  {m:36,g:"F",h:"Tunisia",a:"Japan",d:"2026-06-20",day:"Sat",t:"12:00 AM"},
  {m:38,g:"H",h:"Spain",a:"Saudi Arabia",d:"2026-06-21",day:"Sun",t:"12:00 PM"},
  {m:39,g:"G",h:"Belgium",a:"Iran",d:"2026-06-21",day:"Sun",t:"3:00 PM"},
  {m:37,g:"H",h:"Uruguay",a:"Cape Verde",d:"2026-06-21",day:"Sun",t:"6:00 PM"},
  {m:40,g:"G",h:"New Zealand",a:"Egypt",d:"2026-06-21",day:"Sun",t:"9:00 PM"},
  {m:43,g:"J",h:"Argentina",a:"Austria",d:"2026-06-22",day:"Mon",t:"1:00 PM"},
  {m:42,g:"I",h:"France",a:"Iraq",d:"2026-06-22",day:"Mon",t:"5:00 PM"},
  {m:41,g:"I",h:"Norway",a:"Senegal",d:"2026-06-22",day:"Mon",t:"8:00 PM"},
  {m:44,g:"J",h:"Jordan",a:"Algeria",d:"2026-06-22",day:"Mon",t:"11:00 PM"},
  {m:47,g:"K",h:"Portugal",a:"Uzbekistan",d:"2026-06-23",day:"Tue",t:"1:00 PM"},
  {m:45,g:"L",h:"England",a:"Ghana",d:"2026-06-23",day:"Tue",t:"4:00 PM"},
  {m:46,g:"L",h:"Panama",a:"Croatia",d:"2026-06-23",day:"Tue",t:"7:00 PM"},
  {m:48,g:"K",h:"Colombia",a:"DR Congo",d:"2026-06-23",day:"Tue",t:"10:00 PM"},
  {m:51,g:"B",h:"Switzerland",a:"Canada",d:"2026-06-24",day:"Wed",t:"3:00 PM"},
  {m:52,g:"B",h:"Bosnia and Herzegovina",a:"Qatar",d:"2026-06-24",day:"Wed",t:"3:00 PM"},
  {m:49,g:"C",h:"Scotland",a:"Brazil",d:"2026-06-24",day:"Wed",t:"6:00 PM"},
  {m:50,g:"C",h:"Morocco",a:"Haiti",d:"2026-06-24",day:"Wed",t:"6:00 PM"},
  {m:53,g:"A",h:"Czechia",a:"Mexico",d:"2026-06-24",day:"Wed",t:"9:00 PM"},
  {m:54,g:"A",h:"South Africa",a:"South Korea",d:"2026-06-24",day:"Wed",t:"9:00 PM"},
  {m:55,g:"E",h:"Curaçao",a:"Ivory Coast",d:"2026-06-25",day:"Thu",t:"4:00 PM"},
  {m:56,g:"E",h:"Ecuador",a:"Germany",d:"2026-06-25",day:"Thu",t:"4:00 PM"},
  {m:57,g:"F",h:"Japan",a:"Sweden",d:"2026-06-25",day:"Thu",t:"7:00 PM"},
  {m:58,g:"F",h:"Tunisia",a:"Netherlands",d:"2026-06-25",day:"Thu",t:"7:00 PM"},
  {m:59,g:"D",h:"Türkiye",a:"United States",d:"2026-06-25",day:"Thu",t:"10:00 PM"},
  {m:60,g:"D",h:"Paraguay",a:"Australia",d:"2026-06-25",day:"Thu",t:"10:00 PM"},
  {m:61,g:"I",h:"Norway",a:"France",d:"2026-06-26",day:"Fri",t:"3:00 PM"},
  {m:62,g:"I",h:"Senegal",a:"Iraq",d:"2026-06-26",day:"Fri",t:"3:00 PM"},
  {m:65,g:"H",h:"Cape Verde",a:"Saudi Arabia",d:"2026-06-26",day:"Fri",t:"8:00 PM"},
  {m:66,g:"H",h:"Uruguay",a:"Spain",d:"2026-06-26",day:"Fri",t:"8:00 PM"},
  {m:63,g:"G",h:"Egypt",a:"Iran",d:"2026-06-26",day:"Fri",t:"11:00 PM"},
  {m:64,g:"G",h:"New Zealand",a:"Belgium",d:"2026-06-26",day:"Fri",t:"11:00 PM"},
  {m:67,g:"L",h:"Panama",a:"England",d:"2026-06-27",day:"Sat",t:"5:00 PM"},
  {m:68,g:"L",h:"Croatia",a:"Ghana",d:"2026-06-27",day:"Sat",t:"5:00 PM"},
  {m:71,g:"K",h:"Colombia",a:"Portugal",d:"2026-06-27",day:"Sat",t:"7:30 PM"},
  {m:72,g:"K",h:"DR Congo",a:"Uzbekistan",d:"2026-06-27",day:"Sat",t:"7:30 PM"},
  {m:69,g:"J",h:"Algeria",a:"Austria",d:"2026-06-27",day:"Sat",t:"10:00 PM"},
  {m:70,g:"J",h:"Jordan",a:"Argentina",d:"2026-06-27",day:"Sat",t:"10:00 PM"},
];

// Real 2026 group-stage fixtures (FIFA official schedule). Each match has a
// stable match number (m), group (g), home (h), away (a), and date (d).
// id uses the match number so results stay keyed correctly.
function groupStageFixtures() {
  return GROUP_FIXTURES.map((f) => ({
    id: `group-m${f.m}`, stage: "group",
    home: f.h, away: f.a, group: f.g, date: f.d, matchNum: f.m,
    day: f.day, time: f.t,
  }));
}

// Known knockout fixtures for a stage (currently only R32 is pre-filled; R16+
// matchups depend on results, so they fall back to whatever's in koGames).
function knockoutFixtures(stage) {
  if (stage === "r32") return R32_FIXTURES.map((f) => ({ ...f, stage: "r32" }));
  if (stage === "r16") return R16_FIXTURES.map((f) => ({ ...f, stage: "r16" }));
  if (stage === "qf") return QF_FIXTURES.map((f) => ({ ...f, stage: "qf" }));
  if (stage === "sf") return SF_FIXTURES.map((f) => ({ ...f, stage: "sf" }));
  return [];
}

// Bracket tree: how knockout games feed forward (official 2026 layout).
const BRACKET = {
  r16: [
    { id: "r16-1", feeds: ["r32-3", "r32-6"] },
    { id: "r16-2", feeds: ["r32-1", "r32-4"] },
    { id: "r16-3", feeds: ["r32-12", "r32-11"] },
    { id: "r16-4", feeds: ["r32-10", "r32-9"] },
    { id: "r16-5", feeds: ["r32-2", "r32-5"] },
    { id: "r16-6", feeds: ["r32-7", "r32-8"] },
    { id: "r16-7", feeds: ["r32-15", "r32-14"] },
    { id: "r16-8", feeds: ["r32-13", "r32-16"] },
  ],
  qf: [
    { id: "qf-1", feeds: ["r16-1", "r16-2"] },
    { id: "qf-2", feeds: ["r16-3", "r16-4"] },
    { id: "qf-3", feeds: ["r16-5", "r16-6"] },
    { id: "qf-4", feeds: ["r16-7", "r16-8"] },
  ],
  sf: [
    { id: "sf-1", feeds: ["qf-1", "qf-2"] },
    { id: "sf-2", feeds: ["qf-3", "qf-4"] },
  ],
  final: [{ id: "final-1", feeds: ["sf-1", "sf-2"] }],
};
// Group finishing position: 1=won group, 2=runner-up, 3=3rd advanced, 0=out.
const GROUP_OUTCOME = {
  Mexico: 1, "South Africa": 2, "South Korea": 0, Czechia: 0,
  Switzerland: 1, Canada: 2, "Bosnia and Herzegovina": 3, Qatar: 0,
  Brazil: 1, Morocco: 2, Scotland: 0, Haiti: 0,
  "United States": 1, Australia: 2, Paraguay: 3, "Türkiye": 0,
  Germany: 1, "Ivory Coast": 2, Ecuador: 3, "Curaçao": 0,
  Netherlands: 1, Japan: 2, Sweden: 3, Tunisia: 0,
  Belgium: 1, Egypt: 2, Iran: 0, "New Zealand": 0,
  Spain: 1, "Cape Verde": 2, Uruguay: 0, "Saudi Arabia": 0,
  France: 1, Norway: 2, Senegal: 3, Iraq: 0,
  Argentina: 1, Austria: 2, Algeria: 3, Jordan: 0,
  Colombia: 1, Portugal: 2, "DR Congo": 3, Uzbekistan: 0,
  England: 1, Croatia: 2, Ghana: 3, Panama: 0,
};

// Where a team was eliminated, or null if still alive (or not yet decided).
// Walks: group stage (GROUP_OUTCOME 0 = out), then each knockout round — if the
// team played a knockout game and lost, that's their exit stage.
// Returns a short label: "Groups", "R32", "R16", "QF", "SF", "Final".
const KO_ROUND_OF = { r32: "R32", r16: "R16", qf: "QF", sf: "SF", final: "Final" };
function teamEliminationStage(team, results) {
  if (GROUP_OUTCOME[team] === 0) return "Groups"; // eliminated in groups
  if (GROUP_OUTCOME[team] === undefined) return null; // unknown team
  // Build the knockout node list with resolved participants.
  const r32by = Object.fromEntries(R32_FIXTURES.map((f) => [f.id, f]));
  const nodeIndex = {};
  [...BRACKET.r16, ...BRACKET.qf, ...BRACKET.sf, ...BRACKET.final]
    .forEach((n) => { nodeIndex[n.id] = n; });
  const winOf = (id) => {
    const res = results[id];
    return res ? winnerOf(res) : null;
  };
  const teamsAt = (id) => {
    if (r32by[id]) return [r32by[id].home, r32by[id].away];
    const node = nodeIndex[id];
    if (!node) return [null, null];
    return node.feeds.map((c) => winOf(c));
  };
  // Check each knockout game; if this team played and lost, return that round.
  const order = ["r32", "r16", "qf", "sf", "final"];
  const nodesByStage = {
    r32: Object.keys(r32by), r16: BRACKET.r16.map((n) => n.id),
    qf: BRACKET.qf.map((n) => n.id), sf: BRACKET.sf.map((n) => n.id),
    final: BRACKET.final.map((n) => n.id),
  };
  for (const stage of order) {
    for (const id of nodesByStage[stage]) {
      const [a, b] = teamsAt(id);
      if (a !== team && b !== team) continue;
      const w = winOf(id);
      if (w && w !== team) return KO_ROUND_OF[stage]; // lost here
    }
  }
  return null; // still alive or their next game isn't decided
}
function MatchupsTab({ g, save, patch }) {
  const ownerOf = useCallback(
    (team) => g.picks.find((p) => p.team === team)?.playerId, [g.picks]);
  const pname = (pid) => g.players.find((p) => p.id === pid)?.name || "—";
  const fixtures = useMemo(groupStageFixtures, []);

  // knockout games are user-added
  const [koHome, setKoHome] = useState("");
  const [koAway, setKoAway] = useState("");
  const [koStage, setKoStage] = useState("r32");
  const koGames = g.koGames || [];

  async function setWinner(matchId, team) {
    const toggleOff = g.results[matchId] === team;
    if (patch) await patch({ op: "setResult", matchId, winner: toggleOff ? null : team });
    else {
      const results = { ...g.results };
      if (toggleOff) delete results[matchId]; else results[matchId] = team;
      await save({ ...g, results });
    }
  }
  async function addKo() {
    if (!koHome || !koAway || koHome === koAway) return;
    const game = { id: `ko-${uid()}`, stage: koStage, home: koHome, away: koAway };
    await save({ ...g, koGames: [...koGames, game] });
    setKoHome(""); setKoAway("");
  }
  async function rmKo(gid) {
    const results = { ...g.results }; delete results[gid];
    await save({ ...g, koGames: koGames.filter((k) => k.id !== gid), results });
  }

  const stageLabel = (k) => STAGES.find((s) => s.key === k)?.label || k;

  function GameRow({ game, removable }) {
    const hOwn = ownerOf(game.home), aOwn = ownerOf(game.away);
    const sameOwner = hOwn && hOwn === aOwn;
    const winner = g.results[game.id];
    return (
      <div style={{ ...card, padding: "10px 12px", marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, opacity: 0.45, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {stageLabel(game.stage)}{game.group ? ` · Group ${game.group}` : ""}
          </span>
          {(game.day && game.time) && <span style={{ fontSize: 11, opacity: 0.6,
            fontWeight: 600 }}>{fmtWhen(game)}</span>}
          {sameOwner && <span style={{ fontSize: 10, opacity: 0.5 }}>same owner · no contest</span>}
          {removable && <button className="ghost" style={{ padding: "2px 8px", fontSize: 12 }}
            onClick={() => rmKo(game.id)}>✕</button>}
        </div>
        {[game.home, game.away].map((team) => {
          const own = ownerOf(team);
          const won = winner === team;
          return (
            <button key={team} onClick={() => setWinner(game.id, team)}
              className="match-side"
              style={{ background: won ? S.win : S.card2,
                borderColor: won ? S.winB : "transparent" }}>
              <span style={{ fontSize: 16 }}>{FLAG[team]}</span>
              <span style={{ flex: 1, textAlign: "left", fontWeight: 600, fontSize: 14 }}>{team}</span>
              <span style={{ fontSize: 11, opacity: 0.6 }}>{own ? pname(own) : "undrafted"}</span>
              {won && <span style={{ fontSize: 13 }}>✓</span>}
            </button>
          );
        })}
        {game.stage === "group" && (
          <button onClick={() => setWinner(game.id, "DRAW")}
            style={{ width: "100%", marginTop: 6, padding: "8px 12px", borderRadius: 10,
              cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
              background: winner === "DRAW" ? S.card2 : "transparent",
              border: `1px dashed ${winner === "DRAW" ? S.winB : "#2a3556"}`,
              color: winner === "DRAW" ? S.winB : "#9fb0d0" }}>
            {winner === "DRAW" ? "✓ Draw" : "Draw"}
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <p style={{ fontSize: 13, opacity: 0.55, margin: "0 0 14px", lineHeight: 1.5 }}>
        Tap the winner of each game. Points credit that team's owner. Add knockout
        games as the bracket fills in.
      </p>

      {/* Knockout adder */}
      <details style={{ marginBottom: 16 }}>
        <summary style={{ ...lbl, cursor: "pointer", listStyle: "none" }}>
          + Add a knockout game
        </summary>
        <div style={{ ...card, marginTop: 8 }}>
          <select className="inp" value={koStage} onChange={(e) => setKoStage(e.target.value)}
            style={{ marginBottom: 8 }}>
            {STAGES.filter((s) => s.key !== "group").map((s) =>
              <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <select className="inp" value={koHome} onChange={(e) => setKoHome(e.target.value)}>
              <option value="">Team 1…</option>
              {ALL_TEAMS.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
            <select className="inp" value={koAway} onChange={(e) => setKoAway(e.target.value)}>
              <option value="">Team 2…</option>
              {ALL_TEAMS.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <button className="primary" onClick={addKo} style={{ width: "100%", marginTop: 8 }}>
            Add game
          </button>
        </div>
      </details>

      {koGames.length > 0 && (
        <>
          <div style={lbl}>Knockout games</div>
          {koGames.map((game) => <GameRow key={game.id} game={game} removable />)}
          <div style={{ height: 12 }} />
        </>
      )}

      <div style={lbl}>Group stage · 72 games</div>
      {fixtures.map((game) => <GameRow key={game.id} game={game} />)}
    </>
  );
}

/* ---------- Standings ---------- */
/* Rival scoring constants */
/* ============================================================================
   SCORING CONFIG — all numeric values exposed here per the core spec.
   Channels: match points, progression, rivalry, fames/shames.
   (Undrafted-team penalty intentionally omitted for now.)
============================================================================ */
const SCORING = {
  // Round multiplier — applies to MATCH POINTS only. Plateaus at the final.
  mult: { group: 1.0, r32: 1.5, r16: 2.0, qf: 3.0, sf: 4.0, final: 4.0 },
  // Round depth — additive index used by rivalry curves only (NOT a multiplier).
  depth: { group: 0, r32: 1, r16: 2, qf: 3, sf: 4, final: 5 },
  // 1. Match points (per team, per match, before the round multiplier).
  match: { win: 10, tie: 3, loss: -5 },
  // 2. Progression bonuses (flat, awarded once when a team advances/wins).
  prog: {
    outOfGroup: 8,   // reached R32
    winR32: 12,      // reached R16
    winR16: 18,      // reached QF
    winQF: 28,       // reached SF
    reachFinal: 40,  // reached the final
    winFinal: 60,    // champion (sole title reward)
  },
  // 3. Rivalries (directional). value = base + step * round_depth.
  rivalry: {
    h2hWinBase: 8,   h2hWinStep: 5,    // your team beats rival's team
    h2hLossBase: -8, h2hLossStep: -5,  // your team loses to rival's team
    schadenBase: 4,  schadenStep: 2,   // knockout only; rival's team loses
    haterBonus: 2,                     // flat: beat a team owned by someone who
                                       // picked YOU (and you didn't pick them)
    netCap: 70,                        // clamp total rivalry to ±70
  },
  // 4. Fames / Shames channel cap (labels themselves defined in LEGENDS below).
  fameShameCap: 25,
};

// Legacy stage-points object kept for any old references / group setup UI.
const RIVAL = {
  beatYourRival: 2, beatYourHater: 1, ownBothFinalists: 10,
  speedFastest: 1, speedSlowest: -1, latePenalty: -1,
};
// Fames (+), Shames (-), Legends (0, cosmetic). Each award:
//   kind: "fame" | "shame" | "legend"
//   value: point value (legends are 0)
//   split: if true and N players qualify, value is split evenly (value/N each)
//   ready: false = trigger needs data not yet wired (team rankings, in-game
//          lead tracking, group tables); these simply don't fire yet.
// Order of operations in the engine: split -> sum per player -> clamp ±cap.
const AWARDS = [
  // ---- FAMES ----
  { key: "adhd",     kind: "fame", value: 3, emoji: "⚡", ready: true,  split: true,
    label: "ADHD", desc: "Fastest drafter." },
  { key: "loser",    kind: "fame", value: 3, emoji: "💀", ready: true,  split: true,
    label: "Biggest Loser", desc: "Most match losses across your teams." },
  { key: "cstudent", kind: "fame", value: 3, emoji: "📝", ready: true,  split: true,
    label: "C-Student", desc: "Most draws across your teams." },
  { key: "flawless", kind: "fame", value: 5, emoji: "💯", ready: true,  split: true,
    label: "Flawless", desc: "A team of yours won all 3 group matches." },
  { key: "punchup",  kind: "fame", value: 5, emoji: "🥊", ready: false, split: true,
    label: "Punching Up", desc: "A team ranked outside your top 20 won its group." },
  { key: "clencher", kind: "fame", value: 5, emoji: "😬", ready: false, split: true,
    label: "Sphincter Clencher", desc: "Most of your wins came by exactly 1 goal." },
  { key: "littleman",kind: "fame", value: 8, emoji: "🐜", ready: false, split: true,
    label: "Little Man Syndrome", desc: "A sub-top-20 team of yours reached the QF." },
  { key: "laststand",kind: "fame", value: 8, emoji: "🏰", ready: true,  split: true,
    label: "Last Man Standing", desc: "Only player with a team left in the semis." },
  { key: "knicks5",  kind: "fame", value: 8, emoji: "🗽", ready: true,  split: true,
    label: "Knicks in 5!", desc: "A team of yours eliminated France." },
  { key: "bestfriend",kind: "fame", value: 1, emoji: "🤝", ready: true,  split: true,
    label: "Turner's Best Friend", desc: "Most recent person to log into the app." },
  // ---- SHAMES ----
  { key: "shortbus", kind: "shame", value: -3, emoji: "🚌", ready: true,  split: true,
    label: "Short Bus", desc: "Slowest drafter." },
  { key: "token",    kind: "shame", value: -3, emoji: "🎟️", ready: true,  split: true,
    label: "Token Invite", desc: "Nobody picked you as their rival." },
  { key: "late",     kind: "shame", value: -3, emoji: "🐌", ready: true,  split: true,
    label: "Unfashionably Late", desc: "Last to accept the draft invite." },
  { key: "france",   kind: "shame", value: -5, emoji: "🍟", ready: true,  split: false,
    label: "Freedom Fries", desc: "Drafted France." },
  { key: "england",  kind: "shame", value: -5, emoji: "🇬🇧", ready: true,  split: false,
    label: "Empire Strikes Back", desc: "Drafted England." },
  { key: "sportwash",kind: "shame", value: -5, emoji: "🛢️", ready: true,  split: false,
    label: "Sportswashing", desc: "Drafted Saudi Arabia or Qatar." },
  { key: "remorse",  kind: "shame", value: -5, emoji: "🤦", ready: true,  split: true,
    label: "Buyer's Remorse", desc: "Your first-round pick is out in the group stage." },
  { key: "doa",      kind: "shame", value: -5, emoji: "⚰️", ready: false, split: true,
    label: "Dead on Arrival", desc: "Your first-round pick finished last in its group." },
  { key: "earlyexit",kind: "shame", value: -5, emoji: "🚪", ready: false, split: true,
    label: "Early Exit Special", desc: "Most of your teams out in the group stage." },
  { key: "bottle",   kind: "shame", value: -5, emoji: "🍾", ready: false, split: true,
    label: "Bottle Job", desc: "A top-5 team of yours missed the semis." },
  { key: "soclose",  kind: "shame", value: -5, emoji: "😭", ready: true,  split: true,
    label: "So Close", desc: "A team of yours lost the final." },
  { key: "bridesmaid",kind: "shame", value: -5, emoji: "💐", ready: true,  split: true,
    label: "Bridesmaid", desc: "Had a semifinalist but none reached the final." },
  { key: "choke",    kind: "shame", value: -8, emoji: "🥶", ready: false, split: true,
    label: "Choke Artist", desc: "A team lost a QF+ match after leading." },
  { key: "spectator",kind: "shame", value: -8, emoji: "🍿", ready: true,  split: true,
    label: "Spectator", desc: "None of your teams reached the round of 16." },
  { key: "selfplay", kind: "shame", value: -5, emoji: "🍆", ready: true,  split: true,
    label: "Masturbator", desc: "Most played games where both teams were your own." },
  { key: "sharkhate",kind: "shame", value: -5, emoji: "🦈", ready: true,  split: false,
    label: "Shark Hates You", desc: "Last person in the group to log into the app." },
  // ---- LEGENDS (0 pts, cosmetic) ----
  { key: "villain",  kind: "legend", value: 0, emoji: "😈", ready: true, split: false,
    label: "Villain", desc: "Picked as a rival by the most players." },
  { key: "maga",     kind: "legend", value: 0, emoji: "🦅", ready: true, split: false,
    label: "Secret MAGA", desc: "Drafted the USA." },
  { key: "vibes",    kind: "legend", value: 0, emoji: "✨", ready: true, split: false,
    label: "Vibes Only", desc: "Drafted Brazil." },
];
// Back-compat alias: some older code references LEGENDS.
const LEGENDS = AWARDS;
const KO_STAGES = ["r32", "r16", "qf", "sf", "final"]; // ascending depth

// Is the draft board open for picking?
function draftIsOpen(g) {
  if (g.mode === "inperson") return g.inPersonReady;
  if (g.started) return true;
  if (g.scheduledStart && Date.now() >= g.scheduledStart) return true;
  return false;
}
// Everyone has tapped START DRAFTING (remote). For in-person, the single device
// drives readiness, so it's ready as soon as inPersonReady is set.
function allReady(g) {
  if (g.mode === "inperson") return !!g.inPersonReady;
  const ready = g.draftReady || {};
  // Only players who are in the draft need to be ready. Everyone listed must be ready.
  return g.players.length > 0 && g.players.every((p) => ready[p.id]);
}
function readyCount(g) {
  const ready = g.draftReady || {};
  return g.players.filter((p) => ready[p.id]).length;
}
// The player who accepted last (by timestamp) — gets the late penalty.
function lastAccepter(g) {
  const entries = Object.entries(g.accepted || {});
  if (entries.length === 0) return null;
  // only penalize if everyone who's going to accept has (draft started) — but
  // we compute "current last" live; it settles once draft opens.
  let last = entries[0];
  for (const e of entries) if (e[1] > last[1]) last = e;
  return last[0];
}

function computeStandings(g, resultsOverride) {
  const rosterSize = {};
  g.players.forEach((p) => { rosterSize[p.id] = g.picks.filter((x) => x.playerId === p.id).length; });
  const ownerOf = (team) => g.picks.find((p) => p.team === team)?.playerId;
  const teamsOf = (pid) => g.picks.filter((x) => x.playerId === pid).map((x) => x.team);
  const rivals = g.rivals || {};

  // Per-player channel accumulators.
  const matchB = {}, progB = {}, rivalB = {};
  const winPts = {}, drawPts = {}, matchNeg = {}; // win points / draw points / loss points
  const wins = {}, losses = {}, draws = {};
  g.players.forEach((p) => {
    matchB[p.id] = progB[p.id] = rivalB[p.id] = 0;
    winPts[p.id] = drawPts[p.id] = matchNeg[p.id] = 0;
    wins[p.id] = losses[p.id] = draws[p.id] = 0;
  });

  const ko = g.koGames || [];
  const allGames = [...groupStageFixtures(), ...ko];
  // Results are shared across all groups. An explicit override (used for
  // single-game point-delta math) takes precedence when provided.
  const sharedResults = resultsOverride || { ...(g.results || {}), ...RESULTS.get() };
  const M = SCORING.mult, D = SCORING.depth, MP = SCORING.match, PR = SCORING.prog, RV = SCORING.rivalry;

  // Helper: rounds a player owns a rival relationship with the loser's owner.
  const isMyRival = (me, other) => rivals[me] === other;

  for (const game of allGames) {
    const res = sharedResults[game.id];
    if (!res) continue;
    const stage = game.stage;
    const mult = M[stage] ?? 1;
    const depth = D[stage] ?? 0;
    const hOwn = ownerOf(game.home), aOwn = ownerOf(game.away);

    // ---- Channel 1: match points (both teams, per result) ----
    if (isDraw(res)) {
      if (hOwn) { matchB[hOwn] += MP.tie * mult; drawPts[hOwn] += MP.tie * mult; draws[hOwn] += 1; }
      if (aOwn) { matchB[aOwn] += MP.tie * mult; drawPts[aOwn] += MP.tie * mult; draws[aOwn] += 1; }
      continue; // a tie cannot happen in knockouts; no winner/progression
    }
    const w = winnerOf(res);
    if (!w) continue;
    const loser = game.home === w ? game.away : game.home;
    const wOwn = ownerOf(w), lOwn = ownerOf(loser);
    if (wOwn) { matchB[wOwn] += MP.win * mult; winPts[wOwn] += MP.win * mult; wins[wOwn] += 1; }
    if (lOwn) { matchB[lOwn] += MP.loss * mult; matchNeg[lOwn] += MP.loss * mult; losses[lOwn] += 1; }

    // ---- Channel 2 (progression) is computed separately below from knockout
    // results, so nothing to do here in the per-game loop. ----

    // ---- Channel 3a: head-to-head rivalry (any stage) ----
    // Evaluate directionally for BOTH owners involved.
    if (wOwn && lOwn && wOwn !== lOwn) {
      const winnerPickedLoser = isMyRival(wOwn, lOwn); // wOwn -> lOwn
      const loserPickedWinner = isMyRival(lOwn, wOwn); // lOwn -> wOwn
      // winner's perspective: did winner's rival own the loser? -> H2H win
      if (winnerPickedLoser) rivalB[wOwn] += RV.h2hWinBase + RV.h2hWinStep * depth;
      // loser's perspective: did loser's rival own the winner? -> H2H loss
      if (loserPickedWinner) rivalB[lOwn] += RV.h2hLossBase + RV.h2hLossStep * depth;
      // Hater bonus: the winner beat someone who picked THEM as a rival, but the
      // winner did NOT pick that person (one-directional). Mutual rivals get the
      // H2H win above instead, not this.
      if (loserPickedWinner && !winnerPickedLoser) rivalB[wOwn] += RV.haterBonus;
    }
  }

  // ---- Channel 2: progression ----
  // out-of-group: any owned team that reached the knockouts (+8 once).
  // knockout wins: award the bonus for the round that was won.
  const advancedTeams = new Set();
  for (const game of ko) { advancedTeams.add(game.home); advancedTeams.add(game.away); }
  advancedTeams.forEach((team) => { const o = ownerOf(team); if (o) progB[o] += PR.outOfGroup; });
  for (const game of ko) {
    const res = sharedResults[game.id];
    if (!res) continue;
    const w = winnerOf(res); if (!w) continue;
    const wOwn = ownerOf(w); if (!wOwn) continue;
    if (game.stage === "r32") progB[wOwn] += PR.winR32;
    else if (game.stage === "r16") progB[wOwn] += PR.winR16;
    else if (game.stage === "qf") progB[wOwn] += PR.winQF;
    else if (game.stage === "sf") progB[wOwn] += PR.reachFinal;
    else if (game.stage === "final") progB[wOwn] += PR.winFinal;
  }

  // ---- Channel 3b: schadenfreude (KNOCKOUTS ONLY) ----
  // Consolation for the knocked-out: a player earns schadenfreude ONLY once ALL
  // of their own teams are out of the tournament. After that, every time any of
  // their rival's teams loses a knockout game, they get +base+step*depth. This is
  // purely additive to the eliminated player — it never affects the rival who lost.
  const teamsOfPlayer = (pid) => g.picks.filter((x) => x.playerId === pid).map((x) => x.team);
  const isFullyOut = (pid) => {
    const mine = teamsOfPlayer(pid);
    if (mine.length === 0) return false;
    return mine.every((t) => teamEliminationStage(t, sharedResults) !== null);
  };
  const fullyOut = {};
  g.players.forEach((p) => { fullyOut[p.id] = isFullyOut(p.id); });

  for (const game of ko) {
    const res = sharedResults[game.id];
    if (!res) continue;
    const w = winnerOf(res); if (!w) continue;
    const loser = game.home === w ? game.away : game.home;
    const lOwn = ownerOf(loser);
    const depth = D[game.stage] ?? 0;
    if (!lOwn) continue; // the losing team must be owned to be someone's rival
    g.players.forEach((p) => {
      if (rivals[p.id] !== lOwn) return;   // p's rival owns the loser
      if (!fullyOut[p.id]) return;         // p must have no teams left alive
      rivalB[p.id] += RV.schadenBase + RV.schadenStep * depth;
    });
  }

  // ---- Rivalry net cap ±70 ----
  g.players.forEach((p) => {
    rivalB[p.id] = Math.max(-RV.netCap, Math.min(RV.netCap, rivalB[p.id]));
  });

  // ---- Channel 4: Fames/Shames (labels), clamped to ±cap ----
  const dt = g.draftTime || {};
  const drafted = g.picks.length === ALL_TEAMS.length;
  const timed = g.players.filter((p) => dt[p.id] != null);
  let fastestId = null, slowestId = null;
  if (drafted && timed.length === g.players.length && g.players.length >= 2) {
    let fast = timed[0], slow = timed[0];
    for (const p of timed) {
      if (dt[p.id] < dt[fast.id]) fast = p;
      if (dt[p.id] > dt[slow.id]) slow = p;
    }
    if (fast.id !== slow.id) { fastestId = fast.id; slowestId = slow.id; }
  }
  let lateId = null;
  if (g.mode !== "inperson" && draftIsOpen(g)) {
    const lid = lastAccepter(g);
    if (lid && Object.keys(g.accepted || {}).length >= 2) lateId = lid;
  }
  const legends = computeLegends(g, { losses, draws, dt, teamsOf, rivals,
    fastestId, slowestId, lateId, timed, drafted, sharedResults, ownerOf });

  // ---- Split-points: an award held by N players is worth value/N to each.
  // Order: split -> sum per player -> clamp ±cap. ----
  // Count holders per award key across all players.
  const holderCount = {};
  Object.values(legends).forEach((awards) => {
    awards.forEach((a) => { holderCount[a.key] = (holderCount[a.key] || 0) + 1; });
  });
  const fameRaw = {};
  g.players.forEach((p) => { fameRaw[p.id] = 0; });
  Object.entries(legends).forEach(([pid, awards]) => {
    awards.forEach((a) => {
      const n = a.split ? (holderCount[a.key] || 1) : 1; // non-split: full value each
      fameRaw[pid] += a.value / n;
    });
  });
  const fameB = {};
  g.players.forEach((p) => {
    const capped = Math.max(-SCORING.fameShameCap, Math.min(SCORING.fameShameCap, fameRaw[p.id]));
    fameB[p.id] = Math.round(capped * 10) / 10;
  });

  return g.players.map((p) => {
    const total = matchB[p.id] + progB[p.id] + rivalB[p.id] + fameB[p.id];
    return {
      id: p.id, name: p.name, roster: rosterSize[p.id] || 0,
      wins: wins[p.id], losses: losses[p.id], draws: draws[p.id],
      // channel breakdown
      matchB: Math.round(matchB[p.id] * 10) / 10,
      winPts: Math.round(winPts[p.id] * 10) / 10,
      drawPts: Math.round(drawPts[p.id] * 10) / 10,
      matchNeg: Math.round(matchNeg[p.id] * 10) / 10,
      progB: progB[p.id],
      rivalB: rivalB[p.id],
      fameB: fameB[p.id],
      legends: legends[p.id] || [],
      total: Math.round(total * 10) / 10,
    };
  }).sort((a, b) => b.total - a.total);
}

// Points each player earned IN A SPECIFIC ROUND: match points from that round's
// games + rivalry earned in those games + the progression bonus tied to that
// round. For "group" the progression piece is the out-of-group (+8 per team that
// reached the R32). For a knockout stage it's that round's win bonus (e.g. +12
// for winning an R32 game). Rivalry here is the round's raw contribution (the
// global ±70 cap is applied to the season total, not per round).
function roundPoints(g, stage) {
  const ownerOf = (team) => g.picks.find((p) => p.team === team)?.playerId;
  const rivals = g.rivals || {};
  const isMyRival = (me, other) => rivals[me] === other;
  const results = { ...(g.results || {}), ...RESULTS.get() };
  const M = SCORING.mult, D = SCORING.depth, MP = SCORING.match, PR = SCORING.prog, RV = SCORING.rivalry;

  const pts = {}, match = {}, rival = {}, prog = {};
  const wins = {}, losses = {}, draws = {};
  g.players.forEach((p) => {
    pts[p.id] = match[p.id] = rival[p.id] = prog[p.id] = 0;
    wins[p.id] = losses[p.id] = draws[p.id] = 0;
  });

  const ko = g.koGames || [];
  const games = stage === "group"
    ? groupStageFixtures()
    : ko.filter((k) => k.stage === stage);
  const mult = M[stage] ?? 1, depth = D[stage] ?? 0;

  for (const game of games) {
    const res = results[game.id];
    if (!res) continue;
    const hOwn = ownerOf(game.home), aOwn = ownerOf(game.away);
    if (isDraw(res)) {
      if (hOwn) { match[hOwn] += MP.tie * mult; draws[hOwn]++; }
      if (aOwn) { match[aOwn] += MP.tie * mult; draws[aOwn]++; }
      continue;
    }
    const w = winnerOf(res); if (!w) continue;
    const loser = game.home === w ? game.away : game.home;
    const wOwn = ownerOf(w), lOwn = ownerOf(loser);
    if (wOwn) { match[wOwn] += MP.win * mult; wins[wOwn]++; }
    if (lOwn) { match[lOwn] += MP.loss * mult; losses[lOwn]++; }
    // head-to-head rivalry for this game
    if (wOwn && lOwn && wOwn !== lOwn) {
      const winnerPickedLoser = isMyRival(wOwn, lOwn);
      const loserPickedWinner = isMyRival(lOwn, wOwn);
      if (winnerPickedLoser) rival[wOwn] += RV.h2hWinBase + RV.h2hWinStep * depth;
      if (loserPickedWinner) rival[lOwn] += RV.h2hLossBase + RV.h2hLossStep * depth;
      if (loserPickedWinner && !winnerPickedLoser) rival[wOwn] += RV.haterBonus;
    }
    // schadenfreude only applies to knockout rounds, and only pays a player who
    // is themselves fully out of the tournament (see computeStandings for rule).
    if (stage !== "group" && lOwn) {
      g.players.forEach((p) => {
        if (rivals[p.id] !== lOwn) return;
        const mine = g.picks.filter((x) => x.playerId === p.id).map((x) => x.team);
        const fullyOut = mine.length > 0 &&
          mine.every((t) => teamEliminationStage(t, results) !== null);
        if (!fullyOut) return;
        rival[p.id] += RV.schadenBase + RV.schadenStep * depth;
      });
    }
  }

  // progression tied to this round
  if (stage === "group") {
    // +8 for each owned team that reached the R32 (appears in koGames r32 set)
    const r32Teams = new Set();
    ko.filter((k) => k.stage === "r32").forEach((k) => { r32Teams.add(k.home); r32Teams.add(k.away); });
    r32Teams.forEach((t) => { const o = ownerOf(t); if (o) prog[o] += PR.outOfGroup; });
  } else {
    const bonusKey = { r32: PR.winR32, r16: PR.winR16, qf: PR.winQF, sf: PR.reachFinal, final: PR.winFinal };
    for (const game of games) {
      const res = results[game.id]; if (!res) continue;
      const w = winnerOf(res); if (!w) continue;
      const o = ownerOf(w); if (!o) continue;
      prog[o] += bonusKey[stage] || 0;
    }
  }

  const out = {};
  g.players.forEach((p) => {
    out[p.id] = {
      total: Math.round((match[p.id] + rival[p.id] + prog[p.id]) * 10) / 10,
      match: Math.round(match[p.id] * 10) / 10,
      prog: prog[p.id],
      rival: Math.round(rival[p.id] * 10) / 10,
      wins: wins[p.id], losses: losses[p.id], draws: draws[p.id],
    };
  });
  return out;
}
// Only awards flagged ready:true can fire; the rest await unbuilt data.
function computeLegends(g, ctx) {
  const { losses, draws, dt, teamsOf, rivals, fastestId, slowestId, lateId,
    timed, drafted, sharedResults, ownerOf } = ctx;
  const out = {};
  g.players.forEach((p) => { out[p.id] = []; });
  const byKey = Object.fromEntries(AWARDS.map((a) => [a.key, a]));
  const give = (pid, key) => { const a = byKey[key]; if (a && a.ready) out[pid].push(a); };

  // ---- per-team result facts from shared results ----
  const fixtures = groupStageFixtures();
  const ko = g.koGames || [];
  // group record per team
  const groupRec = {}; // team -> {w,d,l,played}
  const ensure = (t) => (groupRec[t] = groupRec[t] || { w: 0, d: 0, l: 0, played: 0 });
  for (const gm of fixtures) {
    const res = sharedResults[gm.id]; if (!res) continue;
    ensure(gm.home); ensure(gm.away);
    groupRec[gm.home].played++; groupRec[gm.away].played++;
    if (isDraw(res)) { groupRec[gm.home].d++; groupRec[gm.away].d++; continue; }
    const w = winnerOf(res); if (!w) continue;
    const l = gm.home === w ? gm.away : gm.home;
    groupRec[w].w++; groupRec[l].l++;
  }
  // which teams reached each KO stage (appeared in a game of that stage)
  const reached = {}; KO_STAGES.forEach((s) => { reached[s] = new Set(); });
  for (const gm of ko) { if (reached[gm.stage]) { reached[gm.stage].add(gm.home); reached[gm.stage].add(gm.away); } }
  // teams that LOST the final
  const finalLosers = new Set();
  for (const gm of ko) {
    if (gm.stage !== "final") continue;
    const res = sharedResults[gm.id]; if (!res) continue;
    const w = winnerOf(res); if (!w) continue;
    finalLosers.add(gm.home === w ? gm.away : gm.home);
  }
  // teams a player eliminated (their team beat France, for Knicks in 5)
  const eliminatedFranceBy = new Set();
  // self-play: played games where both teams are owned by the same player
  const selfPlayCount = {}; g.players.forEach((p) => { selfPlayCount[p.id] = 0; });
  for (const gm of [...fixtures, ...ko]) {
    const res = sharedResults[gm.id]; if (!res) continue;
    const ho = ownerOf(gm.home), ao = ownerOf(gm.away);
    if (ho && ho === ao) selfPlayCount[ho] += 1;
    const w = winnerOf(res); if (!w) continue;
    const loser = gm.home === w ? gm.away : gm.home;
    // "eliminates France" — count any knockout loss by France, or a group loss too (kept simple: any defeat)
    if (loser === "France") { const o = ownerOf(w); if (o) eliminatedFranceBy.add(o); }
  }

  // ---- multi-qualifier argmax: ALL tied at the positive max qualify ----
  const allMax = (vals) => {
    let best = -Infinity;
    g.players.forEach((p) => { const v = vals[p.id] || 0; if (v > best) best = v; });
    if (best <= 0) return [];
    return g.players.filter((p) => (vals[p.id] || 0) === best).map((p) => p.id);
  };

  // FAMES (draft + result based)
  if (fastestId) give(fastestId, "adhd");
  allMax(losses).forEach((pid) => give(pid, "loser"));
  allMax(draws).forEach((pid) => give(pid, "cstudent"));

  // Flawless — any team of yours won all 3 group games
  g.players.forEach((p) => {
    const mine = teamsOf(p.id);
    if (mine.some((t) => groupRec[t] && groupRec[t].w === 3)) give(p.id, "flawless");
  });

  // Knicks in 5! — a team of yours eliminated France
  eliminatedFranceBy.forEach((pid) => give(pid, "knicks5"));

  // Last Man Standing — only player with a team in the semis
  const semiOwners = new Set();
  reached.sf.forEach((t) => { const o = ownerOf(t); if (o) semiOwners.add(o); });
  if (semiOwners.size === 1) give([...semiOwners][0], "laststand");

  // Login-based awards: Turner's Best Friend (most recent login, +1, splits) and
  // Shark Hates You (last/least-recent login, -5, no split). Never-logged-in
  // players count as the oldest (timestamp 0).
  const lastLogin = g.lastLogin || {};
  const loginTs = (pid) => lastLogin[pid] || 0;
  if (g.players.length > 0) {
    let newest = -Infinity, oldest = Infinity;
    g.players.forEach((p) => {
      const t = loginTs(p.id);
      if (t > newest) newest = t;
      if (t < oldest) oldest = t;
    });
    // Best Friend only fires if at least one player has actually logged in.
    if (newest > 0) {
      g.players.forEach((p) => { if (loginTs(p.id) === newest) give(p.id, "bestfriend"); });
    }
    // Shark Hates You: everyone tied at the oldest login (incl. never-logged-in).
    // Only when there's a real spread (newest !== oldest), so a single player or
    // an all-equal group doesn't get shamed.
    if (newest !== oldest) {
      g.players.forEach((p) => { if (loginTs(p.id) === oldest) give(p.id, "sharkhate"); });
    }
  }

  // SHAMES (draft based)
  if (slowestId) give(slowestId, "shortbus");
  if (lateId) give(lateId, "late");
  // Masturbator — most played games where both teams were your own (≥1 to qualify)
  allMax(selfPlayCount).forEach((pid) => give(pid, "selfplay"));
  // Token Invite — nobody picked you as their rival
  const rivalCounts = {}; g.players.forEach((p) => { rivalCounts[p.id] = 0; });
  Object.values(rivals).forEach((rid) => { if (rid && rivalCounts[rid] != null) rivalCounts[rid] += 1; });
  // Villain (legend) — picked by the MOST players, and only if they stand out
  // (a strict max above the runner-up). If everyone's equally picked, no villain.
  const counts = g.players.map((p) => rivalCounts[p.id] || 0);
  const maxC = Math.max(...counts, 0);
  const atMax = g.players.filter((p) => (rivalCounts[p.id] || 0) === maxC);
  const villains = (maxC > 0 && atMax.length < g.players.length) ? atMax.map((p) => p.id) : [];
  villains.forEach((pid) => give(pid, "villain"));
  // Token Invite — zero rival-picks (and not somehow also the villain)
  g.players.forEach((p) => {
    if ((rivalCounts[p.id] || 0) === 0 && !villains.includes(p.id)) give(p.id, "token");
  });

  // Roster-fact shames/legends (each fires independently; no split)
  g.players.forEach((p) => {
    const mine = teamsOf(p.id);
    if (mine.includes("France")) give(p.id, "france");
    if (mine.includes("England")) give(p.id, "england");
    if (mine.includes("Saudi Arabia") || mine.includes("Qatar")) give(p.id, "sportwash");
    if (mine.includes("United States")) give(p.id, "maga");
    if (mine.includes("Brazil")) give(p.id, "vibes");
  });

  // Buyer's Remorse — your first-round pick is out in the group stage.
  // first-round pick = each player's earliest pick (lowest at / first in picks order)
  const firstPickOf = {};
  g.players.forEach((p) => {
    const mine = g.picks.filter((x) => x.playerId === p.id);
    if (mine.length) firstPickOf[p.id] = mine[0].team; // picks are in draft order
  });
  // a team is "out in group stage" if it played all 3 and did NOT reach R32
  const inKnockouts = new Set(); ko.forEach((gm) => { inKnockouts.add(gm.home); inKnockouts.add(gm.away); });
  g.players.forEach((p) => {
    const t = firstPickOf[p.id]; if (!t) return;
    const rec = groupRec[t];
    if (rec && rec.played >= 3 && !inKnockouts.has(t)) give(p.id, "remorse");
  });

  // So Close — a team of yours lost the final
  g.players.forEach((p) => {
    if (teamsOf(p.id).some((t) => finalLosers.has(t))) give(p.id, "soclose");
  });
  // Bridesmaid — you had a semifinalist but none of your teams reached the final
  const finalists = reached.final;
  g.players.forEach((p) => {
    const mine = teamsOf(p.id);
    const hadSemi = mine.some((t) => reached.sf.has(t));
    const hadFinal = mine.some((t) => finalists.has(t));
    if (hadSemi && !hadFinal) give(p.id, "bridesmaid");
  });
  // Spectator — none of your teams reached the round of 16.
  // Only meaningful once knockouts exist; require r16 to have started.
  if (reached.r16.size > 0) {
    g.players.forEach((p) => {
      const mine = teamsOf(p.id);
      if (!mine.some((t) => reached.r16.has(t))) give(p.id, "spectator");
    });
  }

  return out;
}
function StandingsTab({ g, highlightId, onOpenPlayer }) {
  const rows = useMemo(() => computeStandings(g), [g]);
  const leader = rows[0]?.total || 0;
  return (
    <>
      <p style={{ fontSize: 13, opacity: 0.55, margin: "0 0 16px", lineHeight: 1.5 }}>
        Total = match points + progression + rivalry + fames/shames. Tap a player to see their page.
      </p>
      {rows.map((r, i) => {
        const chips = [];
        if (r.progB) chips.push(["progression", r.progB]);
        if (r.rivalB) chips.push(["rivalry", r.rivalB]);
        if (r.fameB) chips.push([r.fameB >= 0 ? "fames" : "shames", r.fameB]);
        const barPct = leader > 0 ? Math.max(0, (r.total / leader) * 100) : 0;
        return (
        <div key={r.id} onClick={() => onOpenPlayer && onOpenPlayer(r.id)}
          style={{ ...card, marginBottom: 8, display: "flex",
          alignItems: "center", gap: 14, cursor: onOpenPlayer ? "pointer" : "default",
          borderColor: r.id === highlightId ? S.accent : "#222d47",
          background: r.id === highlightId ? S.card2 : S.card }}>
          <div style={{ fontSize: 22, fontWeight: 800, width: 28, textAlign: "center",
            color: i === 0 ? S.accent : S.ink, opacity: i === 0 ? 1 : 0.4 }}>
            {i === 0 ? "🥇" : i + 1}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{r.name}</div>
            <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>
              {r.wins}W · {r.draws}D · {r.losses}L · {r.roster} teams
            </div>
            {chips.length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>
                {chips.map(([label, val]) => (
                  <span key={label} style={{ fontSize: 10.5, fontWeight: 600,
                    padding: "2px 7px", borderRadius: 999,
                    background: val > 0 ? "rgba(61,220,151,0.15)" : "rgba(255,128,149,0.15)",
                    color: val > 0 ? S.accent : "#ff8095" }}>
                    {val > 0 ? "+" : ""}{val} {label}
                  </span>
                ))}
              </div>
            )}
            <div style={{ height: 5, background: S.card2, borderRadius: 3, marginTop: 6,
              overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${barPct}%`,
                background: S.accent, borderRadius: 3 }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontWeight: 800, fontSize: 22, fontVariantNumeric: "tabular-nums",
              color: r.total < 0 ? "#ff8095" : S.ink }}>
              {r.total}
            </div>
            {onOpenPlayer && <span style={{ opacity: 0.3, fontSize: 16 }}>›</span>}
          </div>
        </div>
        );
      })}
    </>
  );
}

// A sortable numeric key for a fixture: date + kickoff time combined.
// Parses the 12-hour "9:00 PM" time into 24-hour minutes so games sort in the
// real order they kick off, not just by date. Games with no time sort last
// within their day; games with no date sort to the very end.
function gameSortKey(gm) {
  if (!gm || !gm.date) return Number.MAX_SAFE_INTEGER;
  const base = new Date(gm.date + "T00:00:00").getTime();
  let mins = 24 * 60; // default: end of day if time missing
  if (gm.time) {
    const m = gm.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (m) {
      let h = parseInt(m[1], 10) % 12;
      if (/PM/i.test(m[3])) h += 12;
      mins = h * 60 + parseInt(m[2], 10);
    }
  }
  return base + mins * 60 * 1000;
}

/* ---------- "Today's slate" logic (3am ET turnover) ----------
   Games are listed in US Eastern time. The visible day doesn't roll over at
   midnight but at 3am ET, so late-night games stay on the previous day's slate
   until everyone's had a chance to check. We figure out "now" in ET without
   external libs by reading the wall clock in the America/New_York zone. */
function nowPartsET() {
  // Returns { y, m, d, hh, mm } for the current moment in America/New_York.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = {};
  for (const p of fmt.formatToParts(new Date())) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  return {
    y: +parts.year, m: +parts.month, d: +parts.day,
    hh: +(parts.hour === "24" ? "0" : parts.hour), mm: +parts.minute,
  };
}
// The slate date (YYYY-MM-DD) for "now": before 3am ET it's still yesterday.
function currentSlateDate() {
  const p = nowPartsET();
  // Build a date at noon to avoid DST edge issues, then shift back if before 3am.
  let dt = new Date(Date.UTC(p.y, p.m - 1, p.d, 12, 0, 0));
  if (p.hh < 3) dt = new Date(dt.getTime() - 24 * 60 * 60 * 1000);
  return dt.toISOString().slice(0, 10);
}
// Kickoff as an absolute timestamp, interpreting the fixture's ET clock time.
// We approximate ET as UTC-4 (EDT, correct for June–Oct 2026 incl. the WC).
function gameKickoffTs(gm) {
  if (!gm || !gm.date) return null;
  let mins = 12 * 60;
  if (gm.time) {
    const mt = gm.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (mt) {
      let h = parseInt(mt[1], 10) % 12;
      if (/PM/i.test(mt[3])) h += 12;
      mins = h * 60 + parseInt(mt[2], 10);
    }
  }
  // ET (EDT = UTC-4): the UTC instant is the ET wall time + 4 hours.
  const [Y, M, D] = gm.date.split("-").map(Number);
  return Date.UTC(Y, M - 1, D, 4, 0, 0) + mins * 60 * 1000;
}
// A game is "live" if it has kicked off, isn't finished, and we're within a
// generous window after kickoff (matches run ~2h; allow 3h for stoppage/half).
function isGameLive(gm, results) {
  if (!gm) return false;
  if (results && results[gm.id]) return false; // has a result -> final
  const ko = gameKickoffTs(gm);
  if (ko == null) return false;
  const now = Date.now();
  return now >= ko && now <= ko + 3.5 * 60 * 60 * 1000;
}
// The ET slate window for a given slate date is [3am that date, 3am next date).
// A game belongs to the slate if its kickoff falls in that window. This matches
// the real-world feel: a 1am game counts on the previous day's slate.
function slateWindow(dateStr) {
  const [Y, M, D] = dateStr.split("-").map(Number);
  // 3am ET (EDT = UTC-4) -> 07:00 UTC
  const start = Date.UTC(Y, M - 1, D, 7, 0, 0);
  return { start, end: start + 24 * 60 * 60 * 1000 };
}
// All games whose kickoff falls in the slate window for dateStr, sorted by time.
function gamesOnDate(allGames, dateStr) {
  const { start, end } = slateWindow(dateStr);
  return allGames.filter((gm) => {
    const ko = gameKickoffTs(gm);
    return ko != null && ko >= start && ko < end;
  }).sort((a, b) => gameSortKey(a) - gameSortKey(b));
}
// Today's slate, rolling forward to the next slate day that actually has games.
function todaysSlate(allGames) {
  const today = currentSlateDate();
  const onToday = gamesOnDate(allGames, today);
  if (onToday.length > 0) return { date: today, games: onToday, rolledForward: false };
  // roll forward day by day (up to ~40 days) to the next slate with games
  let cursor = today;
  for (let i = 0; i < 45; i++) {
    const [Y, M, D] = cursor.split("-").map(Number);
    const next = new Date(Date.UTC(Y, M - 1, D, 12) + 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    const gs = gamesOnDate(allGames, next);
    if (gs.length) return { date: next, games: gs, rolledForward: true };
    cursor = next;
  }
  return { date: today, games: [], rolledForward: false };
}
/* ---------- Player dashboard: Roster / Upcoming / Home ---------- */
function fmtDate(iso) {
  if (!iso) return "TBD";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
// Prefer the fixture's own day + ET time when available, else format the date.
function fmtWhen(gm) {
  if (gm && gm.day && gm.time) {
    const d = new Date(gm.date + "T12:00:00");
    const md = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${gm.day} ${md} · ${gm.time} ET`;
  }
  return fmtDate(gm && gm.date);
}
function fmtDateTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/* Phase 1: accept the invite */
function AcceptInvite({ g, me, onBack, onAccept }) {
  const count = Object.keys(g.accepted || {}).length;
  return (
    <>
      <Header title={g.name} onBack={onBack} sub={`You're invited, ${me?.name}`} />
      <div style={{ ...card, textAlign: "center", padding: "32px 22px" }}>
        <div style={{ fontSize: 40 }}>✉️</div>
        <h2 style={{ font: "800 22px 'Space Grotesk', sans-serif", margin: "12px 0 6px" }}>
          Join the draft
        </h2>
        <p style={{ opacity: 0.6, fontSize: 14, lineHeight: 1.5, margin: "0 0 4px" }}>
          {g.scheduledStart
            ? `The draft opens ${fmtDateTime(g.scheduledStart)}.`
            : "The organizer will launch the draft once players are in."}
        </p>
        <p style={{ fontSize: 12.5, color: "#ff8095", margin: "10px 0 18px" }}>
          Heads up: the last person to accept loses a point.
        </p>
        <button className="primary" onClick={onAccept} style={{ width: "100%" }}>
          Accept invite
        </button>
        <p style={{ fontSize: 12, opacity: 0.45, marginTop: 12 }}>
          {count} of {g.players.length} accepted so far
        </p>
      </div>
    </>
  );
}

/* Phase 2: accepted, waiting for the draft to open */
function WaitingLobby({ g, me, onBack, pname }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const accepted = g.accepted || {};
  const order = Object.entries(accepted).sort((a, b) => a[1] - b[1]).map(([pid]) => pid);
  const countdown = g.scheduledStart ? g.scheduledStart - Date.now() : null;

  return (
    <>
      <Header title={g.name} onBack={onBack} sub="You're in. Waiting to start." />
      <div style={{ ...card, textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 32 }}>⏳</div>
        {countdown != null && countdown > 0 ? (
          <>
            <div style={{ font: "800 30px 'Space Grotesk', sans-serif", marginTop: 8,
              fontVariantNumeric: "tabular-nums" }}>{fmtCountdown(countdown)}</div>
            <p style={{ opacity: 0.55, fontSize: 13, marginTop: 4 }}>
              until the draft opens · {fmtDateTime(g.scheduledStart)}
            </p>
          </>
        ) : (
          <p style={{ fontWeight: 700, marginTop: 8 }}>
            Waiting for the organizer to launch the draft.
          </p>
        )}
      </div>
      <div style={lbl}>Who's accepted ({order.length}/{g.players.length})</div>
      {g.players.map((p) => {
        const pos = order.indexOf(p.id);
        const yes = pos !== -1;
        return (
          <div key={p.id} style={{ ...card, padding: "10px 14px", marginBottom: 6,
            display: "flex", alignItems: "center", gap: 10,
            borderColor: p.id === me?.id ? S.accent : "#222d47" }}>
            <span style={{ fontSize: 16 }}>{yes ? "✅" : "⬜"}</span>
            <span style={{ flex: 1, fontWeight: 600, fontSize: 14,
              opacity: yes ? 1 : 0.5 }}>{p.name}{p.id === me?.id ? " (you)" : ""}</span>
            {yes && <span style={{ fontSize: 11, opacity: 0.45 }}>#{pos + 1}</span>}
          </div>
        );
      })}
    </>
  );
}
function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/* Step 1: DRAFT STARTING SOON — shows the rules, tap OK to continue. */
function DraftStartingSoon({ g, onOk, onBack }) {
  const theme = THEMES[g.theme] || THEMES[DEFAULT_THEME];
  const row = (label, val) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: "7px 0", borderBottom: "1px solid #1c2540" }}>
      <span style={{ fontSize: 13.5, opacity: 0.8 }}>{label}</span>
      <span style={{ fontWeight: 800, fontSize: 14, color: S.accent,
        fontVariantNumeric: "tabular-nums" }}>{val}</span>
    </div>
  );
  return (
    <>
      <Header title={g.name} onBack={onBack} />
      <div style={{ textAlign: "center", margin: "8px 0 18px" }}>
        <div style={{ font: "800 clamp(30px, 9vw, 44px)/1 'Space Grotesk', sans-serif",
          letterSpacing: "-0.02em", color: S.accent }}>DRAFT STARTING SOON</div>
        <p style={{ opacity: 0.6, fontSize: 14, marginTop: 8 }}>
          Here's how scoring works. Read up, then tap OK.
        </p>
      </div>

      {/* Prominent active-twist callout */}
      <div style={{ borderRadius: 16, padding: "16px 18px", marginBottom: 14,
        background: "linear-gradient(135deg, rgba(36,152,218,0.22), rgba(41,89,146,0.22))",
        border: `1.5px solid ${S.accent}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <span style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.14em",
            fontWeight: 800, color: S.accent }}>Special rule in play</span>
        </div>
        <div style={{ font: "800 19px 'Space Grotesk', sans-serif", marginBottom: 4 }}>
          {theme.label}
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, opacity: 0.9 }}>
          {theme.blurb} <strong style={{ color: S.accent }}>+{theme.amount} points</strong> each
          time it happens.
        </div>
      </div>

      <div style={{ ...card, marginBottom: 12 }}>
        <h2 style={{ font: "800 20px 'Space Grotesk', sans-serif", margin: "0 0 4px" }}>
          The basics
        </h2>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, opacity: 0.8, margin: "0 0 14px" }}>
          You draft national teams. You earn points every time one of your teams
          <strong> wins a match</strong>. The further into the tournament, the more each
          win is worth:
        </p>
        <div style={{ marginBottom: 14 }}>
          {row("Group stage win", `${g.points.group} pt`)}
          {row("Round of 32 win", `${g.points.r32} pts`)}
          {row("Round of 16 win", `${g.points.r16} pts`)}
          {row("Quarterfinal win", `${g.points.qf} pts`)}
          {row("Semifinal win", `${g.points.sf} pts`)}
          {row("Final win (champion)", `${g.points.final} pts`)}
        </div>
        <div style={{ ...lbl }}>Also worth knowing</div>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7,
          opacity: 0.82 }}>
          <li>Fewer teams on your roster = more points per win (it's balanced).</li>
          <li>Next you'll pick a <strong>rival</strong> — beat their teams for bonus points.</li>
          <li>The <strong>fastest</strong> overall drafter earns +{RIVAL.speedFastest}, the
            slowest loses {Math.abs(RIVAL.speedSlowest)}. Don't dawdle on your picks.</li>
          <li>Watch out for <strong>Fames &amp; Shames</strong> — badges that add or subtract points.</li>
        </ul>
      </div>

      <button className="primary" onClick={onOk} style={{ width: "100%" }}>
        OK — pick my rival →
      </button>
    </>
  );
}

/* Big "YOU'RE UP!" gate shown at the start of every one of a player's turns. */
function YoureUp({ g, me, onStart, onBack }) {
  const theme = THEMES[g.theme] || THEMES[DEFAULT_THEME];
  const myCount = g.picks.filter((p) => p.playerId === me?.id).length;
  return (
    <div style={{ minHeight: "70vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", textAlign: "center",
      padding: "24px 16px" }}>
      <div style={{ fontSize: 15, opacity: 0.6, textTransform: "uppercase",
        letterSpacing: "0.16em", marginBottom: 14 }}>{me?.name}</div>
      <div style={{
        font: "800 clamp(54px, 17vw, 110px)/0.9 'Space Grotesk', sans-serif",
        letterSpacing: "-0.03em", color: S.accent, marginBottom: 10 }}>
        YOU'RE UP!
      </div>
      <p style={{ fontSize: 15, opacity: 0.8, margin: "0 0 6px", maxWidth: 320, lineHeight: 1.5 }}>
        Pick {g.picks.length + 1} of {ALL_TEAMS.length} — you're drafting your
        {myCount === 0 ? " first" : ` #${myCount + 1}`} team.
      </p>
      <div style={{ fontSize: 12.5, opacity: 0.6, margin: "8px 0 26px", maxWidth: 320,
        lineHeight: 1.5, padding: "8px 12px", borderRadius: 10, background: S.card2 }}>
        ⚡ {theme.label}: {theme.blurb}
      </div>
      <p style={{ fontSize: 12, opacity: 0.55, margin: "0 0 14px", maxWidth: 320 }}>
        Your clock starts the instant you tap, and stops when you confirm your pick.
        Fastest total drafter earns an award; slowest gets shamed.
      </p>
      <button className="primary" onClick={onStart}
        style={{ width: "100%", maxWidth: 360, padding: 16, fontSize: 17 }}>
        I'm up — start my clock →
      </button>
      <button className="ghost" onClick={onBack}
        style={{ marginTop: 10, fontSize: 13 }}>Back</button>
    </div>
  );
}

/* Step 2: pick your rival, before the draft. */
function RivalPickScreen({ g, me, onSet, pname, onBack }) {
  const [pending, setPending] = useState("");
  const others = g.players.filter((p) => p.id !== me?.id);
  return (
    <>
      <Header title={g.name} onBack={onBack} sub="Pick your rival" />
      <div style={{ ...card, marginBottom: 14 }}>
        <h2 style={{ font: "800 22px 'Space Grotesk', sans-serif", margin: "0 0 8px" }}>
          Choose your rival 🎯
        </h2>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, opacity: 0.82, margin: 0 }}>
          Your rival is the person you most want to beat. When one of your teams beats
          one of theirs head-to-head you score <strong style={{ color: S.accent }}>+{SCORING.rivalry.h2hWinBase}</strong>
          {" "}(and lose the same if they beat you), growing bigger each knockout round. You
          also pick up points when your rival's teams lose in the knockouts. Pick is
          permanent, so choose your nemesis wisely.
        </p>
      </div>
      <div style={{ ...lbl }}>Your rival</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {others.map((p) => {
          const on = pending === p.id;
          return (
            <button key={p.id} onClick={() => setPending(p.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
                borderRadius: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                background: on ? S.accent : S.card2,
                color: on ? "#0b1020" : S.ink,
                border: `1.5px solid ${on ? S.accent : "transparent"}`,
                fontWeight: on ? 800 : 600, fontSize: 16 }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                display: "grid", placeItems: "center", fontWeight: 800,
                background: on ? "#0b1020" : S.bg, color: on ? S.accent : S.ink,
                fontSize: 13 }}>{p.name[0].toUpperCase()}</span>
              {p.name}
            </button>
          );
        })}
      </div>
      <button className="primary" disabled={!pending}
        onClick={() => pending && onSet(pending)}
        style={{ width: "100%", padding: 16, fontSize: 16, opacity: pending ? 1 : 0.4 }}>
        KICK THAT LOSER'S BUTT! 👊
      </button>
    </>
  );
}

/* Step 3: reveal who's rivals with who, then START DRAFTING (marks ready). */
function RivalsReveal({ g, me, pname, onStart, onBack }) {
  const rivals = g.rivals || {};
  const withRival = g.players.filter((p) => rivals[p.id]);
  return (
    <>
      <Header title={g.name} onBack={onBack} sub="The rivalries" />
      <div style={{ textAlign: "center", margin: "4px 0 16px" }}>
        <div style={{ font: "800 clamp(26px,8vw,38px)/1 'Space Grotesk', sans-serif",
          letterSpacing: "-0.02em" }}>⚔️ Rivalries set</div>
        <p style={{ opacity: 0.6, fontSize: 14, marginTop: 8 }}>
          Here's who's gunning for who.
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
        {withRival.map((p) => {
          const mine = p.id === me?.id;
          return (
            <div key={p.id} style={{ ...card, padding: "12px 14px",
              borderColor: mine ? S.accent : "#222d47",
              display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: mine ? 800 : 700, fontSize: 15 }}>
                {p.name}{mine ? " (you)" : ""}
              </span>
              <span style={{ flex: 1, textAlign: "center", opacity: 0.5, fontSize: 18 }}>→</span>
              <span style={{ fontWeight: 700, fontSize: 15, color: S.accent }}>
                {pname(rivals[p.id])}
              </span>
            </div>
          );
        })}
      </div>
      <button className="primary" onClick={onStart} style={{ width: "100%", padding: 16,
        fontSize: 16 }}>
        START DRAFTING
      </button>
      <p style={{ fontSize: 12, opacity: 0.5, textAlign: "center", marginTop: 8 }}>
        The draft begins once everyone has tapped this.
      </p>
    </>
  );
}

/* Step 4: loading lobby — wait for everyone to tap START DRAFTING. */
function ReadyLobby({ g, me, pname, onBack }) {
  const ready = g.draftReady || {};
  const total = g.players.length;
  const have = readyCount(g);
  return (
    <>
      <Header title={g.name} onBack={onBack} sub="Waiting room" />
      <div style={{ textAlign: "center", margin: "12px 0 20px" }}>
        <div className="pulse" style={{ font: "800 clamp(30px,9vw,46px)/1 'Space Grotesk', sans-serif",
          color: S.accent }}>GET READY…</div>
        <p style={{ opacity: 0.7, fontSize: 15, marginTop: 10 }}>
          Waiting for everyone to tap START DRAFTING.
        </p>
        <div style={{ font: "800 26px 'Space Grotesk', sans-serif", marginTop: 10 }}>
          {have} / {total} ready
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {g.players.map((p) => {
          const isReady = !!ready[p.id];
          return (
            <div key={p.id} style={{ ...card, padding: "12px 14px", display: "flex",
              alignItems: "center", gap: 10,
              borderColor: isReady ? S.winB : "#222d47", opacity: isReady ? 1 : 0.6 }}>
              <span style={{ fontSize: 18 }}>{isReady ? "✅" : "⏳"}</span>
              <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>
                {p.name}{p.id === me?.id ? " (you)" : ""}
              </span>
              <span style={{ fontSize: 12, opacity: 0.6 }}>
                {isReady ? "ready" : "waiting…"}
              </span>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 12.5, opacity: 0.5, textAlign: "center", marginTop: 16,
        lineHeight: 1.5 }}>
        The draft clock won't start until everyone's in. Hang tight.
      </p>
    </>
  );
}
function PlayerView({ id, phone, playerId, onBack }) {
  const [page, setPage] = useState("standings");
  const [viewedPlayer, setViewedPlayer] = useState(null); // playerId whose page is open
  const [showHistory, setShowHistory] = useState(false);
  const [ackedPick, setAckedPick] = useState(-1); // last pickIdx the player tapped "YOU'RE UP" for
  const [ackedAt, setAckedAt] = useState(null); // timestamp the player tapped it (clock start)
  const { g, notFound: missing, save, patch } = usePolledGroup(id);
  // Is any game live right now? Drives 5-min polling (and none when nothing's live).
  const liveActive = useMemo(() => {
    if (!g) return false;
    const all = [...groupStageFixtures(), ...(g.koGames || [])];
    const merged = { ...(g.results || {}), ...RESULTS.get() };
    return all.some((gm) => isGameLive(gm, merged));
  }, [g]);
  useSharedResults(liveActive); // re-render on score changes; poll only when live

  // Record this player's last login on the group (once per mount).
  const me0 = g && (playerId
    ? g.players.find((p) => p.id === playerId)
    : g.players.find((p) => normPhone(p.phone) === phone));
  const loggedRef = React.useRef(false);
  useEffect(() => {
    if (!g || !me0 || loggedRef.current) return;
    loggedRef.current = true;
    STORAGE.patch(g.id, { op: "lastLogin", playerId: me0.id });
  }, [g, me0]);

  if (missing) return (
    <div style={{ ...card, textAlign: "center", marginTop: 32 }}>
      <p style={{ opacity: 0.7 }}>Couldn't load this group.</p>
      <button className="primary" onClick={onBack} style={{ marginTop: 10 }}>Back</button>
    </div>
  );
  if (!g) return <Spinner />;

  const me = playerId
    ? g.players.find((p) => p.id === playerId)
    : g.players.find((p) => normPhone(p.phone) === phone);
  const myTeams = g.picks.filter((p) => p.playerId === me?.id).map((p) => p.team);
  const myTeamSet = new Set(myTeams);
  const ownerOf = (team) => g.picks.find((p) => p.team === team)?.playerId;
  const pname = (pid) => g.players.find((p) => p.id === pid)?.name || "—";
  const drafted = g.picks.length === ALL_TEAMS.length;
  const open = draftIsOpen(g);
  const accepted = !!(g.accepted || {})[me?.id];
  const seenRules = !!(g.seenRules || {})[me?.id];

  async function setRival(rivalId) {
    if ((g.rivals || {})[me.id]) return; // already locked
    if (!rivalId) return;
    const r = await patch({ op: "setRival", playerId: me.id, rivalId });
    if (!r || !(r.rivals || {})[me.id]) {
      await save({ ...g, rivals: { ...(g.rivals || {}), [me.id]: rivalId } });
    }
  }
  async function accept() {
    if ((g.accepted || {})[me.id]) return;
    const r = await patch({ op: "accept", playerId: me.id });
    if (!r || !(r.accepted || {})[me.id]) {
      await save({ ...g, accepted: { ...(g.accepted || {}), [me.id]: Date.now() } });
    }
  }
  async function markRulesSeen() {
    const r = await patch({ op: "seenRules", playerId: me.id });
    if (!r || !(r.seenRules || {})[me.id]) {
      await save({ ...g, seenRules: { ...(g.seenRules || {}), [me.id]: true } });
    }
  }
  async function markReady() {
    const r = await patch({ op: "draftReady", playerId: me.id });
    if (!r || !(r.draftReady || {})[me.id]) {
      await save({ ...g, draftReady: { ...(g.draftReady || {}), [me.id]: Date.now() } });
    }
  }

  const myRival = (g.rivals || {})[me?.id];
  const iAmReady = !!(g.draftReady || {})[me?.id];
  const everyoneReady = allReady(g);

  // PHASE 1: remote, not yet accepted -> accept screen
  if (g.mode !== "inperson" && !accepted && !drafted) {
    return <AcceptInvite g={g} me={me} onBack={onBack} onAccept={accept} />;
  }
  // PHASE 2: accepted but draft window not open yet -> waiting lobby
  if (!open && !drafted) {
    return <WaitingLobby g={g} me={me} onBack={onBack} pname={pname} />;
  }

  // ---- PRE-DRAFT SEQUENCE (remote only; once draft window open, before picking) ----
  if (open && !drafted && g.mode !== "inperson") {
    // Step 1: DRAFT STARTING SOON — rules. Tap OK to continue.
    if (!seenRules) {
      return <DraftStartingSoon g={g} onOk={markRulesSeen} onBack={onBack} />;
    }
    // Step 2: pick your rival (before the draft).
    if (!myRival) {
      return <RivalPickScreen g={g} me={me} onSet={setRival} pname={pname} onBack={onBack} />;
    }
    // Step 3: rivals reveal + START DRAFTING (marks you ready).
    if (!iAmReady) {
      return <RivalsReveal g={g} me={me} pname={pname} onStart={markReady} onBack={onBack} />;
    }
    // Step 4: waiting for everyone to hit START DRAFTING.
    if (!everyoneReady) {
      return <ReadyLobby g={g} me={me} pname={pname} onBack={onBack} />;
    }
    // Step 5: live draft — timer only runs now that everyone is ready.
    const myTurn = g.order[g.pickIdx] === g.players.findIndex((p) => p.id === me?.id);
    if (myTurn && ackedPick !== g.pickIdx) {
      return <YoureUp g={g} me={me}
        onStart={() => { setAckedAt(Date.now()); setAckedPick(g.pickIdx); }} onBack={onBack} />;
    }
    return (
      <LiveDraft g={g} me={me} save={save} patch={patch} onBack={onBack}
        myTurn={myTurn} pname={pname}
        ackedAt={ackedPick === g.pickIdx ? ackedAt : null} />
    );
  }
  // In-person: the draft runs on the shared phone. A player opening their own
  // phone mid-draft just waits for it to finish.
  if (open && !drafted && g.mode === "inperson") {
    return (
      <>
        <Header title={g.name} onBack={onBack} sub={`Playing as ${me?.name}`} />
        <div style={{ ...card, textAlign: "center", padding: "40px 24px" }}>
          <div className="pulse" style={{ fontSize: 30 }}>🎲</div>
          <p style={{ fontWeight: 700, marginTop: 10 }}>Draft in progress</p>
          <p style={{ opacity: 0.6, fontSize: 13.5, lineHeight: 1.5, marginTop: 4 }}>
            This draft is happening on the shared phone. Check back here once it's done
            to see your roster and the standings.
          </p>
        </div>
      </>
    );
  }

  // PHASE 4: draft done -> dashboard. Standings is home.
  return (
    <>
      <Header title="Jingo" onBack={onBack}
        sub={<span style={{ display: "block" }}>
          <span style={{ display: "block", fontWeight: 600, opacity: 0.85 }}>World Cup 2026</span>
          <span style={{ display: "block", marginTop: 2 }}>Playing as {me?.name}</span>
        </span>}
        right={<button className="ghost" onClick={() => setShowHistory(true)}
          aria-label="Menu"
          style={{ marginTop: 2, padding: "6px 8px", display: "flex", flexDirection: "column",
            gap: 3, alignItems: "center", justifyContent: "center" }}>
          <span style={{ width: 18, height: 2, background: S.ink, borderRadius: 2, display: "block" }} />
          <span style={{ width: 18, height: 2, background: S.ink, borderRadius: 2, display: "block" }} />
          <span style={{ width: 18, height: 2, background: S.ink, borderRadius: 2, display: "block" }} />
        </button>} />

      {page === "standings" && (
        <StandingsHome g={g} meId={me?.id} ownerOf={ownerOf} pname={pname}
          onOpen={(pg) => setPage(pg)}
          onOpenPlayer={(pid) => { setViewedPlayer(pid); setPage("playerPage"); }} />
      )}
      {page === "playerPage" && (
        <DashSection title={pname(viewedPlayer)} onBack={() => setPage("standings")}>
          <PlayerPage g={g} playerId={viewedPlayer} meId={me?.id} ownerOf={ownerOf} pname={pname}
            onOpenAwards={() => setPage("legends")} />
        </DashSection>
      )}
      {page === "roster" && (
        <DashSection title="My Roster" onBack={() => setPage("standings")}>
          <PlayerRoster g={g} myTeams={myTeams} />
        </DashSection>
      )}
      {page === "upcoming" && (
        <DashSection title="Games" onBack={() => setPage("standings")}>
          <PlayerUpcoming g={g} myTeamSet={myTeamSet} ownerOf={ownerOf} pname={pname} meId={me?.id} />
        </DashSection>
      )}
      {page === "legends" && (
        <DashSection title="Fames & Shames" onBack={() => setPage("standings")}>
          <LegendsPage g={g} meId={me?.id} pname={pname} />
        </DashSection>
      )}
      {page === "competition" && (
        <DashSection title="Competition" onBack={() => setPage("standings")}>
          <PlayerRivals g={g} meId={me?.id} />
        </DashSection>
      )}
      {page === "rivalries" && (
        <DashSection title="Rivalries" onBack={() => setPage("standings")}>
          <RivalriesPage g={g} meId={me?.id} ownerOf={ownerOf} pname={pname} />
        </DashSection>
      )}
      {page === "knockout" && (
        <DashSection title="Knockouts" onBack={() => setPage("standings")}>
          <KnockoutTracker g={g} meId={me?.id} ownerOf={ownerOf} pname={pname} />
        </DashSection>
      )}
      {showHistory && <DraftHistory g={g} onClose={() => setShowHistory(false)} />}
    </>
  );
}

/* Simple section wrapper with a back-to-home control. */
function DashSection({ title, onBack, children }) {
  return (
    <>
      <button className="ghost" onClick={onBack}
        style={{ marginBottom: 12, fontSize: 13 }}>← Home</button>
      <div style={{ ...lbl, marginBottom: 10 }}>{title}</div>
      {children}
    </>
  );
}

/* Standings home: leaderboard + next game + 2x2 nav + rivalries button. */
// Points each player gained/lost from a single finished game, by diffing the
// full standings with vs without that game's result. Reuses the real engine.
function gamePointDeltas(g, gameId) {
  const merged = { ...(g.results || {}), ...RESULTS.get() };
  if (!merged[gameId]) return null;
  const withMap = computeStandings(g, merged);
  const without = { ...merged }; delete without[gameId];
  const withoutMap = computeStandings(g, without);
  const out = {};
  // Only show the channels a player can attribute to THIS game: match (win/loss)
  // points and rivalry. Progression and fames/shames are excluded because they
  // shift indirectly (e.g. award re-splits) and make the per-game number look
  // confusing. Season totals still include everything.
  withMap.forEach((r) => {
    const before = withoutMap.find((b) => b.id === r.id);
    const dMatch = r.matchB - (before ? before.matchB : 0);
    const dRival = r.rivalB - (before ? before.rivalB : 0);
    out[r.id] = { name: r.name, delta: Math.round((dMatch + dRival) * 10) / 10 };
  });
  return out;
}

function StandingsHome({ g, meId, ownerOf, pname, onOpen, onOpenPlayer }) {
  const liveActive = useMemo(() => {
    const all = [...groupStageFixtures(), ...(g.koGames || [])];
    const m = { ...(g.results || {}), ...RESULTS.get() };
    return all.some((gm) => isGameLive(gm, m));
  }, [g]);
  const sharedResults = useSharedResults(liveActive);
  const allGames = useMemo(() => [...groupStageFixtures(), ...(g.koGames || [])], [g]);
  const merged = useMemo(
    () => ({ ...(g.results || {}), ...RESULTS.get(), ...sharedResults }),
    [g, sharedResults]
  );
  const slate = useMemo(() => todaysSlate(allGames), [allGames]);
  const nav = [
    ["roster", "My Roster", "📋"], ["upcoming", "Games", "📅"],
    ["legends", "Fames & Shames", "🏷️"], ["competition", "Competition", "🌍"],
  ];
  const slateLabel = (() => {
    const d = new Date(slate.date + "T12:00:00");
    const lbl = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    return slate.rolledForward ? `Next match day · ${lbl}` : `Today · ${lbl}`;
  })();
  return (
    <>
      {/* Today's slate */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase",
            letterSpacing: "0.1em", color: S.accent }}>{slateLabel}</span>
          <span style={{ fontSize: 11, opacity: 0.5 }}>{slate.games.length} game{slate.games.length === 1 ? "" : "s"}</span>
        </div>
        {slate.games.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: "22px 16px", opacity: 0.6 }}>
            No games scheduled.
          </div>
        ) : slate.games.map((gm) => (
          <SlateGame key={gm.id} g={g} gm={gm} results={merged}
            ownerOf={ownerOf} pname={pname} meId={meId} />
        ))}
      </div>

      {/* Leaderboard */}
      <StandingsTab g={g} highlightId={meId} onOpenPlayer={onOpenPlayer} />

      {/* Knockouts button */}
      <button onClick={() => onOpen("knockout")}
        style={{ ...card, width: "100%", marginTop: 18, padding: "16px",
          cursor: "pointer", fontFamily: "inherit", color: "inherit",
          display: "flex", alignItems: "center", gap: 12, border: `1px solid ${S.accent}` }}>
        <span style={{ fontSize: 24 }}>🏆</span>
        <div style={{ textAlign: "left", flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Knockouts</div>
          <div style={{ opacity: 0.6, fontSize: 12.5 }}>Live bracket + who survived the groups</div>
        </div>
        <span style={{ opacity: 0.4 }}>→</span>
      </button>

      {/* 2x2 nav */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        {nav.map(([key, label, icon]) => (
          <button key={key} onClick={() => onOpen(key)}
            style={{ ...card, padding: "18px 14px", cursor: "pointer", textAlign: "left",
              fontFamily: "inherit", color: "inherit", display: "flex", flexDirection: "column",
              gap: 6, border: "1px solid #222d47" }}>
            <span style={{ fontSize: 24 }}>{icon}</span>
            <span style={{ fontWeight: 800, fontSize: 16 }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Rivalries button */}
      <button onClick={() => onOpen("rivalries")}
        style={{ ...card, width: "100%", marginTop: 10, padding: "16px",
          cursor: "pointer", fontFamily: "inherit", color: "inherit",
          display: "flex", alignItems: "center", gap: 12, border: `1px solid ${S.accent}` }}>
        <span style={{ fontSize: 24 }}>⚔️</span>
        <div style={{ textAlign: "left", flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Rivalries</div>
          <div style={{ opacity: 0.6, fontSize: 12.5 }}>How you're doing against your rival</div>
        </div>
        <span style={{ opacity: 0.4 }}>→</span>
      </button>
    </>
  );
}

/* One game on the home-page slate: upcoming, live, or final.
   Final games expand to show each player's point change from the result. */
function SlateGame({ g, gm, results, ownerOf, pname, meId }) {
  const [open, setOpen] = useState(false);
  const res = results[gm.id];
  const final = !!res;
  const liveScore = !final ? LIVE.getOne(gm.id) : null; // {h,a,status:"live"}
  const live = !final && (isGameLive(gm, results) || !!liveScore);
  const hOwn = ownerOf(gm.home), aOwn = ownerOf(gm.away);
  const mine = hOwn === meId || aOwn === meId;
  const w = final ? winnerOf(res) : null;
  const drawn = final ? isDraw(res) : false;
  // score to display: final result, or live snapshot if mid-game
  const showScore = final ? { h: res.h, a: res.a } : (liveScore ? { h: liveScore.h, a: liveScore.a } : null);

  const deltas = useMemo(
    () => (final ? gamePointDeltas(g, gm.id) : null),
    [g, gm.id, final, res]
  );
  // only players actually affected (non-zero), sorted high to low
  const affected = deltas
    ? Object.entries(deltas).map(([id, v]) => ({ id, ...v }))
        .filter((x) => Math.abs(x.delta) > 0.001)
        .sort((a, b) => b.delta - a.delta)
    : [];

  const sideColor = (team) => final && w === team ? S.winB : S.ink;
  const statusPill = live
    ? <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: "#e5484d",
        padding: "2px 7px", borderRadius: 999, letterSpacing: "0.05em",
        display: "inline-flex", alignItems: "center", gap: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: "#fff",
          display: "inline-block" }} />LIVE</span>
    : final
      ? <span style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.6 }}>FINAL{res.pen ? " (pens)" : ""}</span>
      : <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 600 }}>{gm.time} ET</span>;

  return (
    <div style={{ ...card, padding: "11px 14px", marginBottom: 8,
      borderColor: live ? "#e5484d" : mine ? S.accent : "#222d47" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 8 }}>
        <span style={{ fontSize: 10.5, opacity: 0.5, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.06em" }}>
          {gm.stage === "group" ? `Group ${gm.group}` : (STAGES.find((s) => s.key === gm.stage)?.label || gm.stage)}
        </span>
        {statusPill}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 17 }}>{FLAG[gm.home]}</span>
        <span style={{ flex: 1, fontWeight: hOwn === meId ? 800 : 600, fontSize: 14,
          color: sideColor(gm.home) }}>{gm.home}
          {hOwn && <span style={{ fontSize: 12.5, fontWeight: 700, color: S.accent }}> · {pname(hOwn)}</span>}
        </span>
        {showScore
          ? <span style={{ fontWeight: 800, fontSize: 17, fontVariantNumeric: "tabular-nums",
              color: live ? "#e5484d" : S.ink }}>
              {showScore.h}–{showScore.a}</span>
          : <span style={{ opacity: 0.3, fontWeight: 700 }}>vs</span>}
        <span style={{ flex: 1, textAlign: "right", fontWeight: aOwn === meId ? 800 : 600, fontSize: 14,
          color: sideColor(gm.away) }}>
          {aOwn && <span style={{ fontSize: 12.5, fontWeight: 700, color: S.accent }}>{pname(aOwn)} · </span>}
          {gm.away}</span>
        <span style={{ fontSize: 17 }}>{FLAG[gm.away]}</span>
      </div>

      {final && (
        <>
          <button onClick={() => setOpen((v) => !v)}
            style={{ marginTop: 9, width: "100%", background: "transparent",
              border: "1px solid #222d47", borderRadius: 9, padding: "7px 10px",
              cursor: "pointer", fontFamily: "inherit", color: S.ink,
              display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>
              {drawn ? "Draw" : `${w} won`} · points {open ? "" : "›"}
            </span>
            <span style={{ fontSize: 11, opacity: 0.5 }}>{open ? "hide" : "show"}</span>
          </button>
          {open && (
            <div style={{ marginTop: 8 }}>
              {affected.length === 0 ? (
                <div style={{ fontSize: 12, opacity: 0.5, padding: "4px 2px" }}>
                  No points changed hands on this game.
                </div>
              ) : affected.map((x) => (
                <div key={x.id} style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "5px 2px",
                  borderTop: "1px solid #1b2540" }}>
                  <span style={{ fontSize: 13, fontWeight: x.id === meId ? 800 : 600 }}>
                    {x.name}{x.id === meId ? " (you)" : ""}</span>
                  <span style={{ fontWeight: 800, fontSize: 14, fontVariantNumeric: "tabular-nums",
                    color: x.delta > 0 ? S.accent : "#ff8095" }}>
                    {x.delta > 0 ? "+" : ""}{x.delta}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NextSide({ team, ownerOf, pname, meId }) {
  const own = ownerOf(team);
  const mine = own === meId;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "3px 0" }}>
      <span style={{ fontSize: 20 }}>{FLAG[team]}</span>
      <span style={{ flex: 1, fontWeight: mine ? 800 : 600, fontSize: 16,
        opacity: mine ? 1 : 0.85 }}>{team}</span>
      <span style={{ fontSize: 12, opacity: 0.6, fontWeight: mine ? 700 : 500,
        color: mine ? S.accent : S.ink }}>{own ? pname(own) : "undrafted"}</span>
    </div>
  );
}

/* Rival selection banner — locked permanently once chosen */
function RivalPicker({ g, me, onSet, pname }) {
  const rivalId = (g.rivals || {})[me?.id] || "";
  const locked = !!rivalId;
  const others = g.players.filter((p) => p.id !== me?.id);
  const haters = Object.entries(g.rivals || {})
    .filter(([pid, rid]) => rid === me?.id).map(([pid]) => pname(pid));
  const [pending, setPending] = useState("");

  return (
    <div style={{ ...card, marginBottom: 14, borderColor: locked ? "#ff8095" : S.accent }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>🎯</span>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Your rival</span>
        {locked && <span style={{ fontSize: 11, opacity: 0.5, marginLeft: "auto" }}>🔒 locked</span>}
      </div>

      {locked ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10,
          background: S.card2, borderRadius: 10, padding: "10px 12px" }}>
          <span style={{ fontSize: 16 }}>⚔️</span>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{pname(rivalId)}</span>
        </div>
      ) : (
        <>
          <select className="inp" value={pending} onChange={(e) => setPending(e.target.value)}>
            <option value="">Choose your rival…</option>
            {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="primary" disabled={!pending}
            onClick={() => onSet(pending)}
            style={{ width: "100%", marginTop: 8, opacity: pending ? 1 : 0.4 }}>
            Lock in {pending ? pname(pending) : "rival"}
          </button>
          <p style={{ fontSize: 12, opacity: 0.55, margin: "8px 0 0", lineHeight: 1.5 }}>
            This is permanent — you can't change your rival once locked.
            Beating your rival's team head-to-head scores +{SCORING.rivalry.h2hWinBase}
            (and you lose the same if they beat you), growing each knockout round.
          </p>
        </>
      )}

      {haters.length > 0 && (
        <p style={{ fontSize: 12, margin: "8px 0 0", color: "#ff8095" }}>
          ⚠ {haters.join(", ")} {haters.length === 1 ? "has" : "have"} you as their rival.
        </p>
      )}
    </div>
  );
}

/* Draft history + scoring rules modal */
function DraftHistory({ g, onClose }) {
  const pname = (pid) => g.players.find((p) => p.id === pid)?.name || "—";
  const [view, setView] = useState("order");
  const theme = THEMES[g.theme] || THEMES[DEFAULT_THEME];

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setView("order")}
              className={view === "order" ? "tab on" : "tab"}
              style={{ fontSize: 13, padding: "8px 12px", flex: "none" }}>Draft log</button>
            <button onClick={() => setView("rules")}
              className={view === "rules" ? "tab on" : "tab"}
              style={{ fontSize: 13, padding: "8px 12px", flex: "none" }}>Scoring rules</button>
          </div>
          <button className="ghost" onClick={onClose} style={{ padding: "6px 12px" }}>Done</button>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {view === "order" ? (
            g.picks.length === 0 ? (
              <p style={{ opacity: 0.5 }}>No picks yet.</p>
            ) : g.picks.map((pk, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10,
                padding: "8px 0", borderBottom: "1px solid #222d47" }}>
                <span style={{ width: 26, textAlign: "center", opacity: 0.4, fontWeight: 700,
                  fontSize: 13 }}>{i + 1}</span>
                <span style={{ fontSize: 17 }}>{FLAG[pk.team]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{pk.team}</div>
                  <div style={{ fontSize: 11.5, opacity: 0.5 }}>{pname(pk.playerId)}</div>
                </div>
                {pk.secs != null && (
                  <span style={{ fontSize: 12, opacity: 0.5, fontVariantNumeric: "tabular-nums" }}>
                    {fmtClock(Math.round(pk.secs))}
                  </span>
                )}
              </div>
            ))
          ) : (
            <ScoringRules g={g} theme={theme} />
          )}
        </div>
      </div>
    </div>
  );
}

function ScoringRules({ g, theme }) {
  const Rule = ({ pts, children }) => (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "7px 0",
      borderBottom: "1px solid #1d2740" }}>
      <span style={{ minWidth: 52, fontWeight: 800, fontSize: 14,
        color: typeof pts === "number" && pts < 0 ? "#ff8095" : S.accent,
        fontVariantNumeric: "tabular-nums" }}>
        {typeof pts === "number" && pts > 0 ? "+" : ""}{pts}
      </span>
      <span style={{ fontSize: 13, lineHeight: 1.45, opacity: 0.85 }}>{children}</span>
    </div>
  );
  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ ...lbl, marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  );
  const M = SCORING.mult, MP = SCORING.match, PR = SCORING.prog, RV = SCORING.rivalry;
  const fames = LEGENDS.filter((l) => l.kind === "fame" && l.ready);
  const shames = LEGENDS.filter((l) => l.kind === "shame" && l.ready);

  return (
    <div>
      <p style={{ fontSize: 12.5, opacity: 0.6, lineHeight: 1.5, margin: "0 0 16px" }}>
        Your score = match points + progression + rivalry + fames &amp; shames, summed
        across every team you drafted.
      </p>

      <Section title="Match points (per team, each game)">
        <Rule pts={MP.win}>Win</Rule>
        <Rule pts={MP.tie}>Draw</Rule>
        <Rule pts={MP.loss}>Loss</Rule>
        <p style={{ fontSize: 12, opacity: 0.55, marginTop: 8, lineHeight: 1.5 }}>
          Knockout match points are multiplied by round: Group ×{M.group}, R32 ×{M.r32},
          R16 ×{M.r16}, QF ×{M.qf}, SF/Final ×{M.final}. So a win in the quarterfinals
          is worth {MP.win * M.qf} match points.
        </p>
      </Section>

      <Section title="Progression (flat bonus when a team advances)">
        <Rule pts={PR.outOfGroup}>Reaches the Round of 32 (out of group)</Rule>
        <Rule pts={PR.winR32}>Wins in the R32 (reaches R16)</Rule>
        <Rule pts={PR.winR16}>Wins in the R16 (reaches QF)</Rule>
        <Rule pts={PR.winQF}>Wins in the QF (reaches SF)</Rule>
        <Rule pts={PR.reachFinal}>Reaches the final</Rule>
        <Rule pts={PR.winFinal}>Wins the final (champion)</Rule>
      </Section>

      <Section title="Rivalry (you pick one rival before the draft)">
        <Rule pts={`+${RV.h2hWinBase}`}>
          Your team beats your rival's team, head-to-head (grows +{RV.h2hWinStep} each
          knockout round — up to +{RV.h2hWinBase + RV.h2hWinStep * 5} in the final)
        </Rule>
        <Rule pts={RV.h2hLossBase}>
          Your team loses to your rival's team (mirrors the win, scaling by round)
        </Rule>
        <Rule pts={`+${RV.schadenBase}`}>
          Schadenfreude — your rival's team loses a knockout game (grows by round)
        </Rule>
        <Rule pts={`+${RV.haterBonus}`}>
          You beat a team owned by someone who picked you as their rival, when you
          didn't pick them
        </Rule>
        <p style={{ fontSize: 12, opacity: 0.55, marginTop: 8, lineHeight: 1.5 }}>
          Rivals are locked at the draft. Total rivalry points are capped at ±{RV.netCap}.
        </p>
      </Section>

      <Section title="Fames (good)">
        {fames.map((l) => (
          <Rule key={l.key} pts={l.value}>{l.emoji} {l.label} — {l.desc}</Rule>
        ))}
      </Section>

      <Section title="Shames (bad)">
        {shames.map((l) => (
          <Rule key={l.key} pts={l.value}>{l.emoji} {l.label} — {l.desc}</Rule>
        ))}
        <p style={{ fontSize: 12, opacity: 0.55, marginTop: 8, lineHeight: 1.5 }}>
          Fames &amp; shames are awarded by performance and can shift as results come in.
          Each player's fames-and-shames total is capped at ±{SCORING.fameShameCap}.
        </p>
      </Section>
    </div>
  );
}

/* A team chip used in roster lists: flag + name, struck through with the exit
   round if eliminated, plus W/T/L record. Shared by Competition and player pages. */
function TeamTile({ team, results, koGames = [] }) {
  const rec = (() => {
    let w = 0, d = 0, l = 0;
    const all = [...groupStageFixtures(), ...koGames];
    for (const gm of all) {
      if (gm.home !== team && gm.away !== team) continue;
      const res = results[gm.id]; if (!res) continue;
      if (isDraw(res)) { d++; continue; }
      const win = winnerOf(res); if (!win) continue;
      if (win === team) w++; else l++;
    }
    return { w, d, l };
  })();
  const out = teamEliminationStage(team, results);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7,
      background: S.card2, borderRadius: 9, padding: "7px 9px",
      opacity: out ? 0.62 : 1 }}>
      <span style={{ fontSize: 15 }}>{FLAG[team]}</span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: 5,
        overflow: "hidden" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          textDecoration: out ? "line-through" : "none",
          textDecorationColor: out ? "#ff8095" : "transparent" }}>
          {team}
        </span>
        {out && (
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
            padding: "1px 4px", borderRadius: 4, flexShrink: 0,
            border: "1px solid rgba(255,128,149,0.5)", color: "#ff8095",
            textTransform: "uppercase" }}>{out}</span>
        )}
      </span>
      <span style={{ display: "inline-flex", gap: 4, flexShrink: 0, fontSize: 11, fontWeight: 700 }}>
        {rec.w > 0 && <span style={{ color: S.accent }}>{rec.w}W</span>}
        {rec.d > 0 && <span style={{ color: "#9fb0d0" }}>{rec.d}T</span>}
        {rec.l > 0 && <span style={{ color: "#ff8095" }}>{rec.l}L</span>}
      </span>
    </div>
  );
}

function PlayerRoster({ g, myTeams }) {
  const results = { ...(g.results || {}), ...RESULTS.get() };
  const allGames = [...groupStageFixtures(), ...(g.koGames || [])];
  const teamRecord = (team) => {
    let w = 0, d = 0, l = 0;
    for (const gm of allGames) {
      if (gm.home !== team && gm.away !== team) continue;
      const res = results[gm.id]; if (!res) continue;
      if (isDraw(res)) { d++; continue; }
      const win = winnerOf(res); if (!win) continue;
      if (win === team) w++; else l++;
    }
    return { w, d, l };
  };
  return (
    <>
      <div style={{ ...card, marginBottom: 14, display: "flex",
        justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ opacity: 0.6, fontSize: 14 }}>Teams drafted</span>
        <span style={{ fontWeight: 800, fontSize: 22 }}>{myTeams.length}</span>
      </div>
      {myTeams.length === 0 ? (
        <div style={{ ...card, textAlign: "center", opacity: 0.6 }}>No teams on your roster.</div>
      ) : myTeams.map((team) => {
        const rec = teamRecord(team);
        const played = rec.w + rec.d + rec.l;
        return (
          <div key={team} style={{ ...card, padding: "12px 14px", marginBottom: 8,
            display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>{FLAG[team]}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{team}</div>
              <div style={{ fontSize: 12, opacity: 0.5 }}>
                Group {ALL_TEAMS.find((t) => t.name === team)?.group}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, fontWeight: 800, fontSize: 14 }}>
              {played === 0
                ? <span style={{ opacity: 0.35, fontWeight: 600, fontSize: 12.5 }}>not played</span>
                : <>
                    {rec.w > 0 && <span style={{ color: S.accent }}>{rec.w}W</span>}
                    {rec.d > 0 && <span style={{ color: "#9fb0d0" }}>{rec.d}T</span>}
                    {rec.l > 0 && <span style={{ color: "#ff8095" }}>{rec.l}L</span>}
                  </>}
            </div>
          </div>
        );
      })}
    </>
  );
}

function PlayerRivals({ g, meId }) {
  const results = { ...(g.results || {}), ...RESULTS.get() };
  const allGames = [...groupStageFixtures(), ...(g.koGames || [])];
  const teamWins = (team) => allGames.filter((gm) => winnerOf(results[gm.id]) === team).length;
  // full W/D/L record for a team across all decided games
  const teamRecord = (team) => {
    let w = 0, d = 0, l = 0;
    for (const gm of allGames) {
      if (gm.home !== team && gm.away !== team) continue;
      const res = results[gm.id]; if (!res) continue;
      if (isDraw(res)) { d++; continue; }
      const win = winnerOf(res); if (!win) continue;
      if (win === team) w++; else l++;
    }
    return { w, d, l };
  };

  const rows = g.players.map((p) => {
    const teams = g.picks.filter((x) => x.playerId === p.id).map((x) => x.team);
    const wins = teams.reduce((s, t) => s + teamWins(t), 0);
    return { id: p.id, name: p.name, teams, wins };
  }).sort((a, b) => b.wins - a.wins);

  const [open, setOpen] = useState(() => new Set());
  const toggle = (id) => setOpen((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  return (
    <>
      <p style={{ fontSize: 13, opacity: 0.55, margin: "0 0 14px", lineHeight: 1.5 }}>
        Everyone in the pool and the teams they drafted. Tap a player to see their roster.
      </p>
      {rows.map((r) => {
        const isMe = r.id === meId;
        const expanded = open.has(r.id);
        return (
          <div key={r.id} style={{ ...card, padding: 0, marginBottom: 8, overflow: "hidden",
            borderColor: isMe ? S.accent : "#222d47" }}>
            <button onClick={() => toggle(r.id)} className="rival-head">
              <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                background: isMe ? S.accent : S.card2, color: isMe ? "#0b1020" : S.ink,
                display: "grid", placeItems: "center", fontWeight: 800, fontSize: 16 }}>
                {(r.name || "?")[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>
                  {r.name}{isMe && <span style={{ opacity: 0.6, fontWeight: 500 }}> (you)</span>}
                </div>
                <div style={{ fontSize: 12, opacity: 0.5, marginTop: 1 }}>
                  {r.teams.length} teams · {r.wins} wins
                </div>
              </div>
              <span style={{ opacity: 0.4, fontSize: 13,
                transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▸</span>
            </button>
            {expanded && (
              <div style={{ padding: "0 14px 12px" }}>
                {r.teams.length === 0 ? (
                  <div style={{ opacity: 0.5, fontSize: 13, padding: "4px 0" }}>No teams.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {r.teams.map((team) => (
                      <TeamTile key={team} team={team} results={results} koGames={g.koGames || []} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// The single soonest undecided game across the whole tournament (any teams),
// ordered by actual kickoff time.
function nextUpcomingGame(g) {
  const results = { ...(g.results || {}), ...RESULTS.get() };
  const games = [...groupStageFixtures(), ...(g.koGames || [])]
    .filter((gm) => !results[gm.id])
    .sort((a, b) => gameSortKey(a) - gameSortKey(b));
  return games[0] || null;
}

/* Awards & Shame page: who holds each label, split by positive/zero vs negative. */
/* A single player's page: roster, fames/shames/legends, biggest win & loss. */
function PlayerPage({ g, playerId, meId, ownerOf, pname, onOpenAwards }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const rows = useMemo(() => computeStandings(g), [g]);
  const row = rows.find((r) => r.id === playerId);
  const myTeams = g.picks.filter((x) => x.playerId === playerId).map((x) => x.team);
  const teamSet = new Set(myTeams);
  const results = { ...(g.results || {}), ...RESULTS.get() };
  const allGames = [...groupStageFixtures(), ...(g.koGames || [])];

  // Biggest win / loss: largest goal margin in any match involving one of this
  // player's teams, regardless of who owns the opponent.
  let bigWin = null, bigLoss = null; // { team, opp, gf, ga, margin, stage }
  for (const gm of allGames) {
    const res = results[gm.id];
    if (!res || typeof res !== "object" || res.h == null || res.a == null) continue;
    for (const side of ["home", "away"]) {
      const team = gm[side];
      if (!teamSet.has(team)) continue;
      const gf = side === "home" ? res.h : res.a;
      const ga = side === "home" ? res.a : res.h;
      const opp = side === "home" ? gm.away : gm.home;
      const margin = gf - ga;
      const entry = { team, opp, gf, ga, margin, stage: gm.stage };
      if (margin > 0 && (!bigWin || margin > bigWin.margin)) bigWin = entry;
      if (margin < 0 && (!bigLoss || margin < bigLoss.margin)) bigLoss = entry;
    }
  }

  // Next game: soonest undecided fixture involving one of this player's teams.
  const upcoming = allGames
    .filter((gm) => (teamSet.has(gm.home) || teamSet.has(gm.away)) && !results[gm.id])
    .sort((a, b) => gameSortKey(a) - gameSortKey(b));
  const nextGame = upcoming[0] || null;

  const isMe = playerId === meId;
  const awards = row?.legends || [];
  const fames = awards.filter((a) => a.kind === "fame");
  const shames = awards.filter((a) => a.kind === "shame");
  const legends = awards.filter((a) => a.kind === "legend");

  const MatchCard = ({ title, m, positive }) => (
    <div style={{ ...card, padding: "12px 14px", marginBottom: 8,
      borderColor: positive ? "rgba(61,220,151,0.4)" : "rgba(255,128,149,0.4)" }}>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase",
        letterSpacing: "0.08em", opacity: 0.6, marginBottom: 8,
        color: positive ? S.winB : "#ff8095" }}>{title}</div>
      {!m ? (
        <div style={{ opacity: 0.45, fontSize: 13 }}>None yet</div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{FLAG[m.team]}</span>
          <span style={{ fontWeight: 800, fontSize: 14 }}>{m.team}</span>
          <span style={{ fontWeight: 800, fontSize: 16, fontVariantNumeric: "tabular-nums",
            margin: "0 4px" }}>{m.gf}–{m.ga}</span>
          <span style={{ fontWeight: 600, fontSize: 14, opacity: 0.85 }}>{m.opp}</span>
          <span style={{ fontSize: 18 }}>{FLAG[m.opp]}</span>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Score summary — tap to see where points come from */}
      <div style={{ ...card, marginBottom: 16, padding: 0, overflow: "hidden",
        borderColor: isMe ? S.accent : "#222d47" }}>
        <button onClick={() => setShowBreakdown((v) => !v)}
          style={{ width: "100%", background: "transparent", border: "none",
            cursor: "pointer", fontFamily: "inherit", color: "inherit",
            padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{row?.name}{isMe ? " (you)" : ""}</div>
            <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>
              {row?.wins}W · {row?.draws}D · {row?.losses}L · {myTeams.length} teams
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 800, fontSize: 26, fontVariantNumeric: "tabular-nums",
              color: (row?.total ?? 0) < 0 ? "#ff8095" : S.ink }}>{row?.total ?? 0}</div>
            <div style={{ fontSize: 10.5, opacity: 0.45 }}>
              points · {showBreakdown ? "hide" : "tap for breakdown"}
            </div>
          </div>
          <span style={{ opacity: 0.4, fontSize: 13,
            transform: showBreakdown ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▸</span>
        </button>
        {showBreakdown && (
          <div style={{ padding: "0 16px 14px" }}>
            {(() => {
              const lines = [
                ["Wins", row?.winPts ?? 0, `${row?.wins ?? 0} ${row?.wins === 1 ? "win" : "wins"}`],
                ["Draws", row?.drawPts ?? 0, `${row?.draws ?? 0} ${row?.draws === 1 ? "draw" : "draws"}`],
                ["Losses", row?.matchNeg ?? 0, `${row?.losses ?? 0} ${row?.losses === 1 ? "loss" : "losses"}`],
                ["Progression", row?.progB ?? 0, "Bonuses as your teams advance"],
                ["Rivalry", row?.rivalB ?? 0, "Head-to-head and schadenfreude vs your rival"],
                ["Fames & Shames", row?.fameB ?? 0, "Badges you've earned (tap below for detail)"],
              ];
              return lines.map(([label, val, desc]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 0", borderTop: "1px solid #222d47" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{label}</div>
                    <div style={{ fontSize: 11, opacity: 0.5, marginTop: 1 }}>{desc}</div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 16, fontVariantNumeric: "tabular-nums",
                    color: val > 0 ? S.accent : val < 0 ? "#ff8095" : "#9fb0d0" }}>
                    {val > 0 ? "+" : ""}{val}
                  </div>
                </div>
              ));
            })()}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0 2px",
              borderTop: "2px solid #2c3a5c", marginTop: 2 }}>
              <div style={{ flex: 1, fontWeight: 800, fontSize: 14 }}>Total</div>
              <div style={{ fontWeight: 800, fontSize: 18, fontVariantNumeric: "tabular-nums",
                color: (row?.total ?? 0) < 0 ? "#ff8095" : S.ink }}>{row?.total ?? 0}</div>
            </div>
          </div>
        )}
      </div>

      {/* Next game */}
      <div style={{ ...card, marginBottom: 8, padding: "12px 14px",
        borderColor: nextGame ? S.accent : "#222d47" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: nextGame ? 8 : 0 }}>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase",
            letterSpacing: "0.08em", color: S.accent }}>Next game</span>
          {nextGame && <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 600 }}>{fmtWhen(nextGame)}</span>}
        </div>
        {!nextGame ? (
          <div style={{ opacity: 0.45, fontSize: 13 }}>No upcoming games for their teams.</div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>{FLAG[nextGame.home]}</span>
            <span style={{ fontWeight: teamSet.has(nextGame.home) ? 800 : 600, fontSize: 14,
              color: teamSet.has(nextGame.home) ? S.accent : S.ink }}>{nextGame.home}</span>
            <span style={{ opacity: 0.4, fontWeight: 700, margin: "0 2px" }}>vs</span>
            <span style={{ flex: 1, fontWeight: teamSet.has(nextGame.away) ? 800 : 600, fontSize: 14,
              color: teamSet.has(nextGame.away) ? S.accent : S.ink }}>{nextGame.away}</span>
            <span style={{ fontSize: 18 }}>{FLAG[nextGame.away]}</span>
          </div>
        )}
      </div>

      {/* Biggest win / loss */}
      <MatchCard title="Biggest win" m={bigWin} positive />
      <MatchCard title="Biggest loss" m={bigLoss} positive={false} />

      {/* Fames / Shames / Legends — tap to open the full page */}
      {awards.length > 0 && (
        <button onClick={() => onOpenAwards && onOpenAwards()}
          style={{ ...card, marginTop: 16, width: "100%", textAlign: "left",
            cursor: onOpenAwards ? "pointer" : "default", fontFamily: "inherit", color: "inherit",
            padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <span style={{ ...lbl, flex: 1 }}>Fames & Shames</span>
            {onOpenAwards && <span style={{ opacity: 0.4, fontSize: 13 }}>view all ›</span>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[...fames, ...shames, ...legends].map((a) => (
              <span key={a.key} style={{ display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 12.5, fontWeight: 700, padding: "5px 10px", borderRadius: 999,
                background: a.kind === "fame" ? "rgba(61,220,151,0.15)"
                  : a.kind === "shame" ? "rgba(255,128,149,0.15)" : "rgba(159,176,208,0.15)",
                color: a.kind === "fame" ? S.accent : a.kind === "shame" ? "#ff8095" : "#9fb0d0" }}>
                <span>{a.emoji}</span>{a.label}
              </span>
            ))}
          </div>
        </button>
      )}

      {/* Roster */}
      <div style={{ marginTop: 16 }}>
        <div style={{ ...lbl, marginBottom: 8 }}>Roster</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {myTeams.map((team) => (
            <TeamTile key={team} team={team} results={results} koGames={g.koGames || []} />
          ))}
        </div>
      </div>
    </>
  );
}

function LegendsPage({ g, meId, pname }) {
  const rows = useMemo(() => computeStandings(g), [g]);
  const holders = {};
  AWARDS.forEach((a) => { holders[a.key] = []; });
  rows.forEach((r) => {
    (r.legends || []).forEach((a) => { holders[a.key].push({ name: r.name, id: r.id }); });
  });

  const renderAward = (a) => {
    const who = holders[a.key];
    const mine = who.some((w) => w.id === meId);
    // split value actually applied to each holder
    const n = a.split && who.length > 0 ? who.length : 1;
    const each = a.value / n;
    const sign = each > 0 ? `+${round1(each)}` : `${round1(each)}`;
    const splitNote = a.split && who.length > 1 ? ` (split ${who.length} ways)` : "";
    return (
      <div key={a.key} style={{ ...card, padding: "12px 14px",
        borderColor: mine ? S.accent : "#222d47" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>{a.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{a.label}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 1 }}>{a.desc}</div>
          </div>
          <span style={{ fontWeight: 800, fontSize: 14,
            color: a.value > 0 ? S.winB : (a.value < 0 ? "#ff8095" : "#9fb0d0"),
            fontVariantNumeric: "tabular-nums" }}>
            {a.value === 0 ? "badge" : (who.length > 0 ? sign : (a.value > 0 ? `+${a.value}` : `${a.value}`))}
          </span>
        </div>
        <div style={{ marginTop: 8, fontSize: 13 }}>
          {who.length === 0
            ? <span style={{ opacity: 0.45 }}>Unclaimed</span>
            : <>
                {who.map((w, i) => (
                  <span key={w.id} style={{ fontWeight: w.id === meId ? 800 : 600,
                    color: w.id === meId ? S.accent : S.ink }}>
                    {w.name}{i < who.length - 1 ? ", " : ""}
                  </span>
                ))}
                <span style={{ opacity: 0.45 }}>{splitNote}</span>
              </>}
        </div>
      </div>
    );
  };

  // Only show awards that can currently fire (ready). Group by kind.
  const live = AWARDS.filter((a) => a.ready);
  const fames = live.filter((a) => a.kind === "fame");
  const shames = live.filter((a) => a.kind === "shame");
  const legends = live.filter((a) => a.kind === "legend");

  const Section = ({ emoji, title, color, items }) => (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 10px" }}>
        <span style={{ fontSize: 18 }}>{emoji}</span>
        <span style={{ font: "800 17px 'Space Grotesk', sans-serif", color }}>{title}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
        {items.map(renderAward)}
      </div>
    </>
  );

  return (
    <>
      <p style={{ fontSize: 13, opacity: 0.6, margin: "0 0 16px", lineHeight: 1.5 }}>
        Fames add points, Shames take them away, and Legends are just for glory.
        When several players earn the same one, its value splits evenly among them.
      </p>
      <Section emoji="🏆" title="Fames" color={S.winB} items={fames} />
      <Section emoji="💩" title="Shames" color="#ff8095" items={shames} />
      <Section emoji="🌟" title="Legends" color="#9fb0d0" items={legends} />
    </>
  );
}
function round1(n) { return Math.round(n * 10) / 10; }

/* Rivalries page: each player vs their rival, with head-to-head match record. */
/* Knockout Tracker: live bracket (owner names + flags) and a group-stage
   summary of how each player's teams fared getting out of the groups. */
function KnockoutTracker({ g, meId, ownerOf, pname }) {
  const [tab, setTab] = useState("bracket");
  const results = { ...(g.results || {}), ...RESULTS.get() };

  // Resolve the winning TEAM of any knockout node id, recursively.
  // R32 ids resolve from fixtures + results; deeper rounds resolve from BRACKET.
  const r32by = Object.fromEntries(R32_FIXTURES.map((f) => [f.id, f]));
  const nodeIndex = {};
  [...BRACKET.r16, ...BRACKET.qf, ...BRACKET.sf, ...BRACKET.final]
    .forEach((n) => { nodeIndex[n.id] = n; });

  function winnerTeamOf(id) {
    if (r32by[id]) {
      const res = results[id];
      return res ? winnerOf(res) : null;
    }
    return results[id] ? winnerOf(results[id]) : null;
  }
  // The two teams contesting a node (may be null if earlier round undecided).
  function teamsOf(id) {
    if (r32by[id]) return [r32by[id].home, r32by[id].away];
    const node = nodeIndex[id];
    if (!node) return [null, null];
    return node.feeds.map((childId) => winnerTeamOf(childId));
  }

  const meName = pname(meId);
  // One slot in the bracket: shows owner (or team if unowned) + flag.
  // align "right" puts the flag on the right and right-justifies (mirrored half).
  const Slot = ({ team, advanced, align = "left" }) => {
    const owner = team ? ownerOf(team) : null;
    const mine = owner && owner === meId;
    const flag = <span style={{ fontSize: 13 }}>{team ? FLAG[team] : "—"}</span>;
    const name = (
      <span style={{ fontSize: 12, fontWeight: mine ? 800 : 600,
        color: mine ? S.accent : S.ink, whiteSpace: "nowrap",
        overflow: "hidden", textOverflow: "ellipsis" }}>
        {team ? (owner ? pname(owner) : team) : "TBD"}
      </span>
    );
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6,
        flexDirection: align === "right" ? "row-reverse" : "row",
        padding: "5px 8px", borderRadius: 7, minWidth: 0,
        background: advanced ? "rgba(61,220,151,0.14)" : S.card2,
        border: `1px solid ${mine ? S.accent : "transparent"}`,
        opacity: team ? 1 : 0.4 }}>
        {flag}{name}
      </div>
    );
  };

  // A match box: its two slots, winner highlighted. `align` right-aligns content
  // for the mirrored right half. `spacer` adds top margin to vertically center
  // a box against its two feeder boxes (the classic bracket stagger).
  const MatchBox = ({ id, label, align = "left", spacer = 0 }) => {
    const [t1, t2] = teamsOf(id);
    const w = winnerTeamOf(id);
    return (
      <div style={{ marginBottom: 10, marginTop: spacer }}>
        {label && <div style={{ fontSize: 9.5, opacity: 0.4, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3,
          textAlign: align }}>{label}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <Slot team={t1} advanced={w && t1 === w} align={align} />
          <Slot team={t2} advanced={w && t2 === w} align={align} />
        </div>
      </div>
    );
  };

  // Bracket laid out by round columns. Deeper rounds get more top spacing so
  // each box sits centered against its feeders.
  const Column = ({ title, children, align = "left" }) => (
    <div style={{ minWidth: 128, flex: "0 0 auto" }}>
      <div style={{ ...lbl, fontSize: 10, marginBottom: 8, textAlign: "center" }}>{title}</div>
      {children}
    </div>
  );

  return (
    <>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["bracket", "Bracket"], ["group", "Group stage"], ["r32", "R32"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ flex: 1, padding: "9px 12px", borderRadius: 10, fontWeight: 700,
              fontSize: 13.5, fontFamily: "inherit", cursor: "pointer",
              border: `1px solid ${tab === k ? S.accent : "#222d47"}`,
              background: tab === k ? S.card2 : "transparent",
              color: tab === k ? S.accent : S.ink }}>{l}</button>
        ))}
      </div>

      {tab === "bracket" ? (
        <>
          <p style={{ fontSize: 12, opacity: 0.55, margin: "0 0 12px", lineHeight: 1.5 }}>
            Both halves feed into the Final in the middle. Each slot shows the player who
            owns that team; your teams are highlighted. Scroll sideways to see it all.
          </p>
          <div style={{ overflowX: "auto", paddingBottom: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", minWidth: "min-content" }}>
              {/* LEFT HALF — flows left to right */}
              <Column title="R32">
                {["r32-3", "r32-6", "r32-1", "r32-4", "r32-12", "r32-11", "r32-10", "r32-9"]
                  .map((id) => <MatchBox key={id} id={id} />)}
              </Column>
              <Column title="R16">
                {["r16-1", "r16-2", "r16-3", "r16-4"].map((id, i) =>
                  <MatchBox key={id} id={id} spacer={i === 0 ? 38 : 76} />)}
              </Column>
              <Column title="QF">
                {["qf-1", "qf-2"].map((id, i) =>
                  <MatchBox key={id} id={id} spacer={i === 0 ? 114 : 228} />)}
              </Column>
              <Column title="SF">
                <MatchBox id="sf-1" spacer={266} />
              </Column>

              {/* CENTER — the Final */}
              <Column title="🏆 Final">
                <MatchBox id="final-1" spacer={290} />
              </Column>

              {/* RIGHT HALF — flows right to left (columns reversed, slots right-aligned) */}
              <Column title="SF" align="right">
                <MatchBox id="sf-2" align="right" spacer={266} />
              </Column>
              <Column title="QF" align="right">
                {["qf-3", "qf-4"].map((id, i) =>
                  <MatchBox key={id} id={id} align="right" spacer={i === 0 ? 114 : 228} />)}
              </Column>
              <Column title="R16" align="right">
                {["r16-5", "r16-6", "r16-7", "r16-8"].map((id, i) =>
                  <MatchBox key={id} id={id} align="right" spacer={i === 0 ? 38 : 76} />)}
              </Column>
              <Column title="R32" align="right">
                {["r32-2", "r32-5", "r32-7", "r32-8", "r32-15", "r32-14", "r32-13", "r32-16"]
                  .map((id) => <MatchBox key={id} id={id} align="right" />)}
              </Column>
            </div>
          </div>
        </>
      ) : tab === "group" ? (
        <KnockoutGroupSummary g={g} meId={meId} ownerOf={ownerOf} pname={pname} />
      ) : (
        <KnockoutR32Summary g={g} meId={meId} ownerOf={ownerOf} pname={pname} />
      )}
    </>
  );
}

/* Group-stage summary: who got the most teams through to the R32, with a
   breakdown of finishing positions. Sorted by most-advanced first. */
/* Points box: big total + a small breakdown (games W-L-T, progression, rivalry).
   Shared by the Group stage and R32 round summaries. */
function PointsBox({ p }) {
  const Line = ({ label, val }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10.5 }}>
      <span style={{ opacity: 0.55 }}>{label}</span>
      <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums",
        color: val < 0 ? "#ff8095" : S.ink }}>
        {val > 0 && (label === "Progression" || label === "Rivalry") ? "+" : ""}{val}
      </span>
    </div>
  );
  return (
    <div style={{ background: S.card2, borderRadius: 10, padding: "9px 11px",
      minWidth: 116, flexShrink: 0 }}>
      <div style={{ textAlign: "right", marginBottom: 6 }}>
        <span style={{ fontWeight: 800, fontSize: 22, color: S.accent,
          fontVariantNumeric: "tabular-nums" }}>{p.total}</span>
        <span style={{ fontSize: 10.5, opacity: 0.5, fontWeight: 600 }}> pts</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2,
        paddingTop: 6, borderTop: "1px solid #1d2740" }}>
        <Line label={`Games ${p.wins}-${p.losses}-${p.draws}`} val={p.match} />
        <Line label="Progression" val={p.prog} />
        <Line label="Rivalry" val={p.rival} />
      </div>
    </div>
  );
}

function KnockoutGroupSummary({ g, meId, ownerOf, pname }) {
  const pts = roundPoints(g, "group");
  const rows = g.players.map((p) => {
    const teams = g.picks.filter((x) => x.playerId === p.id).map((x) => x.team);
    let first = 0, second = 0, third = 0, out = 0;
    teams.forEach((t) => {
      const pos = GROUP_OUTCOME[t];
      if (pos === 1) first++;
      else if (pos === 2) second++;
      else if (pos === 3) third++;
      else out++;
    });
    const advanced = first + second + third;
    return { id: p.id, name: p.name, teams: teams.length, first, second, third, out, advanced,
      points: pts[p.id], pct: teams.length ? Math.round((advanced / teams.length) * 100) : 0 };
  }).sort((a, b) => b.advanced - a.advanced || b.pct - a.pct);

  const Tag = ({ n, label, color }) => (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontWeight: 800, fontSize: 15, color, fontVariantNumeric: "tabular-nums" }}>{n}</div>
      <div style={{ fontSize: 9.5, opacity: 0.5, fontWeight: 600 }}>{label}</div>
    </div>
  );

  return (
    <>
      <p style={{ fontSize: 12, opacity: 0.55, margin: "0 0 12px", lineHeight: 1.5 }}>
        How each player's teams did getting out of the groups — most teams through, on top.
      </p>
      {rows.map((r, i) => (
        <div key={r.id} style={{ ...card, marginBottom: 8, padding: "12px 14px",
          borderColor: r.id === meId ? S.accent : "#222d47" }}>
          <div style={{ display: "flex", alignItems: "stretch", gap: 12 }}>
            {/* left: player + big advanced stat */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18, fontWeight: 800, width: 22, textAlign: "center",
                  color: i === 0 ? S.accent : S.ink, opacity: i === 0 ? 1 : 0.4 }}>{i + 1}</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  {r.name}{r.id === meId ? " (you)" : ""}</span>
              </div>
              <div style={{ marginTop: 6, paddingLeft: 32 }}>
                <span style={{ fontWeight: 800, fontSize: 26, color: S.accent,
                  fontVariantNumeric: "tabular-nums" }}>{r.advanced}/{r.teams}</span>
                <span style={{ fontSize: 11.5, opacity: 0.5, marginLeft: 6 }}>through · {r.pct}%</span>
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 10, paddingLeft: 32,
                paddingTop: 8, borderTop: "1px solid #1d2740" }}>
                <Tag n={r.first} label="1st" color={S.accent} />
                <Tag n={r.second} label="2nd" color={S.accent} />
                <Tag n={r.third} label="3rd ✓" color="#9fb0d0" />
                <Tag n={r.out} label="out" color="#ff8095" />
              </div>
            </div>
            {/* right: points box */}
            <PointsBox p={r.points} />
          </div>
        </div>
      ))}
    </>
  );
}

/* R32 summary: of each player's teams that reached the Round of 32, how many
   won their R32 game (advancing to the R16) vs lost. Sorted by most wins. */
function KnockoutR32Summary({ g, meId, ownerOf, pname }) {
  const results = { ...(g.results || {}), ...RESULTS.get() };
  const r32teams = new Set();
  R32_FIXTURES.forEach((f) => { r32teams.add(f.home); r32teams.add(f.away); });
  // resolve each R32 game's winner/loser
  const r32by = Object.fromEntries(R32_FIXTURES.map((f) => [f.id, f]));
  const teamR32Outcome = (team) => {
    // find the R32 fixture this team is in
    const fxt = R32_FIXTURES.find((f) => f.home === team || f.away === team);
    if (!fxt) return "n/a"; // didn't reach R32
    const res = results[fxt.id];
    if (!res) return "pending"; // game not played yet
    const w = winnerOf(res);
    if (!w) return "pending";
    return w === team ? "won" : "lost";
  };

  const pts = roundPoints(g, "r32");
  const rows = g.players.map((p) => {
    const teams = g.picks.filter((x) => x.playerId === p.id).map((x) => x.team);
    const inR32 = teams.filter((t) => r32teams.has(t));
    let won = 0, lost = 0, pending = 0;
    inR32.forEach((t) => {
      const o = teamR32Outcome(t);
      if (o === "won") won++;
      else if (o === "lost") lost++;
      else pending++;
    });
    const decided = won + lost;
    return { id: p.id, name: p.name, inR32: inR32.length, won, lost, pending,
      points: pts[p.id], pct: decided ? Math.round((won / decided) * 100) : 0 };
  }).sort((a, b) => b.won - a.won || b.pct - a.pct);

  const Tag = ({ n, label, color }) => (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontWeight: 800, fontSize: 15, color, fontVariantNumeric: "tabular-nums" }}>{n}</div>
      <div style={{ fontSize: 9.5, opacity: 0.5, fontWeight: 600 }}>{label}</div>
    </div>
  );

  return (
    <>
      <p style={{ fontSize: 12, opacity: 0.55, margin: "0 0 12px", lineHeight: 1.5 }}>
        Of each player's teams that reached the Round of 32, how many won their R32
        game and moved on — most wins on top.
      </p>
      {rows.map((r, i) => (
        <div key={r.id} style={{ ...card, marginBottom: 8, padding: "12px 14px",
          borderColor: r.id === meId ? S.accent : "#222d47" }}>
          <div style={{ display: "flex", alignItems: "stretch", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18, fontWeight: 800, width: 22, textAlign: "center",
                  color: i === 0 ? S.accent : S.ink, opacity: i === 0 ? 1 : 0.4 }}>{i + 1}</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  {r.name}{r.id === meId ? " (you)" : ""}</span>
              </div>
              <div style={{ marginTop: 6, paddingLeft: 32 }}>
                <span style={{ fontWeight: 800, fontSize: 26, color: S.accent,
                  fontVariantNumeric: "tabular-nums" }}>{r.won}/{r.inR32}</span>
                <span style={{ fontSize: 11.5, opacity: 0.5, marginLeft: 6 }}>won · {r.pct}%</span>
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 10, paddingLeft: 32,
                paddingTop: 8, borderTop: "1px solid #1d2740" }}>
                <Tag n={r.won} label="won" color={S.accent} />
                <Tag n={r.lost} label="out" color="#ff8095" />
                <Tag n={r.pending} label="to play" color="#9fb0d0" />
              </div>
            </div>
            <PointsBox p={r.points} />
          </div>
        </div>
      ))}
    </>
  );
}

function RivalriesPage({ g, meId, ownerOf, pname }) {
  const rivals = g.rivals || {};
  const results = { ...(g.results || {}), ...RESULTS.get() };
  const teamsOf = (pid) => g.picks.filter((x) => x.playerId === pid).map((x) => x.team);
  const allGames = [...groupStageFixtures(), ...(g.koGames || [])];

  function headToHead(pid, rid) {
    let pWins = 0, rWins = 0;
    for (const gm of allGames) {
      const res = results[gm.id];
      if (!res || isDraw(res)) continue;
      const w = winnerOf(res);
      if (!w) continue;
      const loser = gm.home === w ? gm.away : gm.home;
      const wOwn = ownerOf(w), lOwn = ownerOf(loser);
      if (wOwn === pid && lOwn === rid) pWins++;
      if (wOwn === rid && lOwn === pid) rWins++;
    }
    return { pWins, rWins };
  }

  const withRival = g.players.filter((p) => rivals[p.id]);
  if (withRival.length === 0) return (
    <div style={{ ...card, textAlign: "center" }}>
      <p style={{ opacity: 0.7, margin: 0 }}>No rivalries set.</p>
    </div>
  );
  return (
    <>
      <p style={{ fontSize: 13, opacity: 0.6, margin: "0 0 14px", lineHeight: 1.5 }}>
        Each player picked a rival before the draft. When your team beats your rival's
        team head-to-head you score big (and lose points if they beat yours), plus
        schadenfreude when your rival's teams lose in the knockouts. Here's the record.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {withRival.map((p) => {
          const rid = rivals[p.id];
          const { pWins, rWins } = headToHead(p.id, rid);
          const mine = p.id === meId;
          const winning = pWins > rWins, losing = pWins < rWins;
          return (
            <div key={p.id} style={{ ...card, padding: "12px 14px",
              borderColor: mine ? S.accent : "#222d47" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: mine ? 800 : 700, fontSize: 15, flex: 1 }}>
                  {p.name}{mine ? " (you)" : ""}
                </span>
                <span style={{ fontWeight: 800, fontSize: 18, fontVariantNumeric: "tabular-nums",
                  color: winning ? S.winB : (losing ? "#ff8095" : S.ink) }}>
                  {pWins}–{rWins}
                </span>
                <span style={{ opacity: 0.5, fontSize: 13 }}>vs</span>
                <span style={{ fontWeight: 700, fontSize: 15, color: S.accent }}>
                  {pname(rid)}
                </span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4 }}>
                {pWins + rWins === 0 ? "No head-to-head results yet."
                  : winning ? `${p.name} is winning this rivalry.`
                  : losing ? `${pname(rid)} has the edge so far.`
                  : "Dead even."}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function PlayerUpcoming({ g, myTeamSet, ownerOf, pname, meId }) {
  const [sub, setSub] = useState("upcoming"); // "played" | "upcoming"
  const results = { ...(g.results || {}), ...RESULTS.get() };
  const allMy = [...groupStageFixtures(), ...(g.koGames || [])]
    .filter((gm) => myTeamSet.has(gm.home) || myTeamSet.has(gm.away));
  const upcoming = allMy.filter((gm) => !results[gm.id])
    .sort((a, b) => gameSortKey(a) - gameSortKey(b)); // soonest first
  const played = allMy.filter((gm) => results[gm.id])
    .sort((a, b) => gameSortKey(b) - gameSortKey(a)); // most recent first

  const stageLabel = (k) => STAGES.find((s) => s.key === k)?.label || k;

  const SubTabs = () => (
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      {[["upcoming", `Upcoming${upcoming.length ? ` (${upcoming.length})` : ""}`],
        ["played", `Played${played.length ? ` (${played.length})` : ""}`]].map(([k, label]) => (
        <button key={k} onClick={() => setSub(k)}
          style={{ flex: 1, padding: "9px 12px", borderRadius: 10, fontWeight: 700,
            fontSize: 13.5, fontFamily: "inherit", cursor: "pointer",
            border: `1px solid ${sub === k ? S.accent : "#222d47"}`,
            background: sub === k ? S.card2 : "transparent",
            color: sub === k ? S.accent : S.ink }}>{label}</button>
      ))}
    </div>
  );

  const playedCard = (gm) => {
    const res = results[gm.id];
    const w = winnerOf(res);
    const drawn = isDraw(res);
    const sc = scoreText(res);
    const hMine = myTeamSet.has(gm.home), aMine = myTeamSet.has(gm.away);
    return (
      <div key={gm.id} style={{ ...card, padding: "10px 14px", marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, opacity: 0.5, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {stageLabel(gm.stage)}{gm.group ? ` · Group ${gm.group}` : ""}
          </span>
          <span style={{ fontSize: 11, opacity: 0.55 }}>{drawn ? "Draw" : `${w} win`}
            {res && res.pen ? " (pens)" : ""}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>{FLAG[gm.home]}</span>
          <span style={{ flex: 1, fontWeight: hMine ? 800 : 600, fontSize: 14,
            color: w === gm.home ? S.winB : S.ink }}>{gm.home}</span>
          <span style={{ fontWeight: 800, fontSize: 18, fontVariantNumeric: "tabular-nums",
            minWidth: 54, textAlign: "center" }}>{sc || (drawn ? "–" : "")}</span>
          <span style={{ flex: 1, textAlign: "right", fontWeight: aMine ? 800 : 600, fontSize: 14,
            color: w === gm.away ? S.winB : S.ink }}>{gm.away}</span>
          <span style={{ fontSize: 16 }}>{FLAG[gm.away]}</span>
        </div>
      </div>
    );
  };

  const upcomingCard = (gm, i) => {
    const hMine = myTeamSet.has(gm.home), aMine = myTeamSet.has(gm.away);
    const headToHead = ownerOf(gm.home) && ownerOf(gm.away)
      && ownerOf(gm.home) !== ownerOf(gm.away) && (hMine || aMine);
    const youOwnBoth = hMine && aMine;
    return (
      <div key={gm.id} style={{ ...card, padding: "12px 14px", marginBottom: 8,
        borderColor: i === 0 ? S.accent : "#222d47" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, opacity: 0.5, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {stageLabel(gm.stage)}{gm.group ? ` · Group ${gm.group}` : ""}
          </span>
          <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 600 }}>{fmtWhen(gm)}</span>
        </div>
        <Side team={gm.home} mine={hMine} owner={ownerOf(gm.home)} pname={pname} />
        <div style={{ textAlign: "center", fontSize: 11, opacity: 0.35, margin: "2px 0" }}>vs</div>
        <Side team={gm.away} mine={aMine} owner={ownerOf(gm.away)} pname={pname} />
        {youOwnBoth && <Tag text="you own both — no head-to-head" />}
        {headToHead && !youOwnBoth && <Tag text={`head-to-head vs ${
          pname(ownerOf(hMine ? gm.away : gm.home))}`} accent />}
      </div>
    );
  };

  const empty = (msg) => (
    <div style={{ ...card, textAlign: "center", padding: "28px 16px" }}>
      <div style={{ fontSize: 26 }}>⚽</div>
      <p style={{ opacity: 0.55, fontSize: 13, marginTop: 8 }}>{msg}</p>
    </div>
  );

  return (
    <>
      <p style={{ fontSize: 13, opacity: 0.55, margin: "0 0 14px" }}>
        Games involving your teams. Bold side is yours.
      </p>
      <SubTabs />
      {sub === "upcoming"
        ? (upcoming.length ? upcoming.map(upcomingCard) : empty("No upcoming games for your teams."))
        : (played.length ? played.map(playedCard) : empty("None of your teams have played yet."))}
    </>
  );
}
function Side({ team, mine, owner, pname }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
      <span style={{ fontSize: 18 }}>{FLAG[team]}</span>
      <span style={{ flex: 1, fontWeight: mine ? 800 : 500, fontSize: 15,
        opacity: mine ? 1 : 0.75 }}>{team}</span>
      <span style={{ fontSize: 11, opacity: 0.5 }}>{owner ? pname(owner) : "undrafted"}</span>
    </div>
  );
}
function Tag({ text, accent }) {
  return (
    <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600,
      color: accent ? S.accent : "#9aa6c2" }}>{text}</div>
  );
}

/* ---------- styles ---------- */
const S = {
  bg: "#0b1020", ink: "#e8ecf5", card: "#141b2e", card2: "#1d2740",
  accent: "#3ddc97", accent2: "#2498da", win: "#16321f", winB: "#3ddc97",
};
const card = { background: S.card, border: "1px solid #222d47", borderRadius: 16, padding: 16 };
const lbl = { fontSize: 12, fontWeight: 700, opacity: 0.5, textTransform: "uppercase",
  letterSpacing: "0.08em", marginBottom: 8 };
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; }
  .inp { width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid #2a3556;
    background: #0f1626; color: #e8ecf5; font-size: 15px; font-family: inherit; }
  .inp:focus { outline: 2px solid #3ddc97; border-color: transparent; }
  select.inp { appearance: none; }
  .primary { background: #3ddc97; color: #0b1020; border: none; padding: 14px;
    border-radius: 14px; font-weight: 800; font-size: 16px; cursor: pointer;
    font-family: inherit; }
  .primary:active { transform: scale(0.99); }
  .ghost { background: #1d2740; color: #e8ecf5; border: none; padding: 10px 14px;
    border-radius: 12px; font-weight: 600; cursor: pointer; font-family: inherit; font-size: 14px; }
  .row-card { width: 100%; display: flex; align-items: center; justify-content: space-between;
    background: #141b2e; border: 1px solid #222d47; border-radius: 16px; padding: 16px;
    margin-bottom: 10px; cursor: pointer; color: inherit; font-family: inherit; text-align: left; }
  .big-choice { width: 100%; display: flex; align-items: center; gap: 16px;
    background: #141b2e; border: 1.5px solid #222d47; border-radius: 18px; padding: 20px;
    margin-bottom: 12px; cursor: pointer; color: #e8ecf5; font-family: inherit; }
  .big-choice:active { transform: scale(0.99); }
  .rival-head { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 14px;
    background: transparent; border: none; color: #e8ecf5; cursor: pointer; font-family: inherit; }
  .modal-bg { position: fixed; inset: 0; background: rgba(5,8,16,0.7); display: flex;
    align-items: flex-end; justify-content: center; z-index: 50; padding: 0; }
  .modal { background: #141b2e; border: 1px solid #2a3556; border-radius: 20px 20px 0 0;
    width: 100%; max-width: 520px; max-height: 80vh; padding: 20px; display: flex;
    flex-direction: column; }
  @media (min-width: 540px) { .modal-bg { align-items: center; } .modal { border-radius: 20px; } }
  .row-card:active { transform: scale(0.995); }
  .tab { flex: 1; padding: 10px; border-radius: 12px; border: none; background: #141b2e;
    color: #e8ecf5; font-weight: 700; font-size: 14px; cursor: pointer; font-family: inherit;
    opacity: 0.55; }
  .tab.on { background: #1d2740; opacity: 1; box-shadow: inset 0 0 0 1.5px #3ddc97; }
  .chip { padding: 6px 12px; border-radius: 999px; border: none; background: #141b2e;
    color: #e8ecf5; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; opacity: 0.7; }
  .chip.on { background: #3ddc97; color: #0b1020; opacity: 1; }
  .team-btn { display: flex; align-items: center; gap: 8px; padding: 11px 12px;
    border-radius: 12px; border: 1px solid #222d47; background: #141b2e; color: #e8ecf5;
    font-family: inherit; }
  .theme-card { width: 100%; display: flex; gap: 12px; align-items: flex-start;
    border: 1.5px solid #222d47; border-radius: 14px; padding: 14px; margin-bottom: 8px;
    color: #e8ecf5; cursor: pointer; font-family: inherit; }
  .match-side { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px;
    border-radius: 10px; border: 1.5px solid transparent; color: #e8ecf5; cursor: pointer;
    font-family: inherit; margin-top: 6px; }
  details summary::-webkit-details-marker { display: none; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
  .pulse { animation: pulse 1.4s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } .pulse { animation: none; } }
`;
