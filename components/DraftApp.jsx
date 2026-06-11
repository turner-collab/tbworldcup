"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";

/* ============================================================================
   WORLD CUP DRAFT — single-file app
   Persistence: window.storage (artifact KV). Swap STORAGE.* for a real
   backend (fetch to your API) when you hst it; the rest of the app is agnostic.
   Notifications: NOTIFY.draftTurn() is a stub that logs. Wire Twilio there
   (server-side) by replacing the body with a fetch to your /notify endpoint.
============================================================================ */

// Organizer password. Change this to whatever you want to hand out.
const ORGANIZER_PASSWORD = "worldcup2026";

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

/* ---------- Storage layer: in-browser (artifact play version) ----------
   Uses Supabase-backed API routes. get/set hit /api/groups, patch does an
   atomic server-side merge, del removes a group. */
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
      if (key === INDEX_KEY) return true; // derived server-side
      const id = idFromKey(key);
      if (id) {
        const r = await fetch(`/api/groups/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ group: value }),
        });
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
  // Atomic single-field change via the server PATCH endpoint.
  async patch(id, payload) {
    try {
      const r = await fetch(`/api/groups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) return null;
      const j = await r.json();
      return j.group || null;
    } catch (e) { console.error("STORAGE.patch failed", e); return null; }
  },
};

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

  const refresh = useCallback(async () => {
    if (savingRef.current) return;
    const startStamp = localStampRef.current;
    const data = await STORAGE.get(groupKey(id));
    // If a local change happened while this read was in flight, drop the result
    // so we never overwrite fresher local state with a stale server copy.
    if (startStamp !== localStampRef.current || savingRef.current) return;
    if (data === null) { setNotFound(true); return; }
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

  const loadIndex = useCallback(async () => {
    const idx = (await STORAGE.get(INDEX_KEY)) || [];
    setIndex(idx);
    setLoading(false);
  }, []);
  useEffect(() => { loadIndex(); }, [loadIndex]);

  // If opened via an invite link (?g=GROUPID), send straight to player login.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const g = new URLSearchParams(window.location.search).get("g");
    if (g) { setInviteId(g); setRoute({ name: "login", inviteId: g }); }
  }, []);

  if (loading) return <Shell><Spinner /></Shell>;

  return (
    <Shell>
      {route.name === "landing" && (
        <Landing
          onOrganizer={() => setRoute({ name: orgUnlocked ? "home" : "orgPassword" })}
          onPlayer={() => setRoute({ name: "login" })} />
      )}
      {route.name === "orgPassword" && (
        <OrganizerPassword onBack={() => setRoute({ name: "landing" })}
          onUnlock={() => { setOrgUnlocked(true); setRoute({ name: "home" }); }} />
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
        <NewGroup onCancel={() => setRoute({ name: "home" })}
          onCreated={async (id) => { await loadIndex(); setRoute({ name: "group", id }); }} />
      )}
      {route.name === "group" && (
        <GroupView id={route.id}
          onBack={async () => { await loadIndex(); setRoute({ name: "home" }); }}
          onPlayAs={(playerId) => setRoute({ name: "playerView", id: route.id, playerId, fromGroup: true })} />
      )}
    </Shell>
  );
}

/* ---------- Landing: choose organizer or player ---------- */
function Landing({ onOrganizer, onPlayer }) {
  return (
    <>
      <header style={{ paddingTop: 48, paddingBottom: 28 }}>
        <h1 style={{ font: "800 46px/0.95 'Space Grotesk', sans-serif",
          letterSpacing: "-0.03em", margin: 0 }}>Jingoism</h1>
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
      <button onClick={onOrganizer} className="big-choice">
        <span style={{ fontSize: 28 }}>🗂️</span>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>I'm the organizer</div>
          <div style={{ opacity: 0.6, fontSize: 13.5, marginTop: 2 }}>
            Create groups, run the draft, log results
          </div>
        </div>
      </button>
    </>
  );
}

/* ---------- Organizer password gate ---------- */
function OrganizerPassword({ onBack, onUnlock }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  function submit() {
    if (pw === ORGANIZER_PASSWORD) onUnlock();
    else { setErr("That's not the right password."); }
  }
  return (
    <>
      <Header title="Organizer access" onBack={onBack}
        sub="Enter the password to create and manage groups." />
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
        {sub && <p style={{ margin: "6px 0 0", opacity: 0.55, fontSize: 14 }}>{sub}</p>}
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
        await navigator.share({ title: `${g.name} — Jingoism`,
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
function DraftBoard({ g, save, patch, canPick, spectating }) {
  const [stageFilter, setStageFilter] = useState("all");
  const taken = useMemo(() => new Set(g.picks.map((p) => p.team)), [g.picks]);
  const done = g.picks.length >= ALL_TEAMS.length;
  const curPlayerIdx = done ? null : g.order[g.pickIdx];
  const curPlayer = curPlayerIdx != null ? g.players[curPlayerIdx] : null;

  const rosterCount = (pid) => g.picks.filter((p) => p.playerId === pid).length;

  // Per-turn live clock. Reset whenever the pick index changes.
  const inPerson = g.mode === "inperson";
  const [turnStart, setTurnStart] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [picking, setPicking] = useState(false);
  // In-person: each turn waits for the player to tap "start" before the clock
  // runs or the board is interactive. Resets every turn.
  const [turnStarted, setTurnStarted] = useState(!inPerson);
  useEffect(() => {
    setTurnStarted(!inPerson);
    setTurnStart(Date.now());
    setNow(Date.now());
    setPicking(false);
  }, [g.pickIdx, inPerson]);
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
        <div style={{ ...card, borderColor: canPick ? S.accent : "#222d47", display: "flex",
          alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12,
            background: canPick ? S.accent : S.card2,
            display: "grid", placeItems: "center", fontWeight: 800,
            color: canPick ? "#0b1020" : S.ink,
            fontSize: 18 }}>{(curPlayer?.name || "?")[0].toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, opacity: 0.55, textTransform: "uppercase",
              letterSpacing: "0.1em" }}>{canPick ? "On the clock" : "Drafting now"}</div>
            <div style={{ fontWeight: 800, fontSize: 19 }}>
              {curPlayer?.name}{canPick ? "" : " — waiting"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 800, fontSize: 22, fontVariantNumeric: "tabular-nums",
              color: elapsed >= 60 ? "#ff8095" : S.ink }}>{fmtClock(elapsed)}</div>
            <div style={{ fontSize: 10, opacity: 0.45, textTransform: "uppercase",
              letterSpacing: "0.08em" }}>this pick</div>
          </div>
        </div>
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
function LiveDraft({ g, me, save, patch, onBack, myTurn, pname }) {
  return (
    <>
      <Header title={g.name} onBack={onBack} sub={`Playing as ${me?.name}`} />
      {!myTurn && (
        <div style={{ ...card, marginBottom: 12, textAlign: "center", borderColor: S.accent }}>
          <p style={{ fontWeight: 700, margin: 0 }}>
            Waiting for {pname(g.players[g.order[g.pickIdx]]?.id)} to pick…
          </p>
          <p style={{ opacity: 0.5, fontSize: 13, margin: "4px 0 0" }}>
            Your clock starts the moment it's your turn.
          </p>
        </div>
      )}
      <DraftBoard g={g} save={save} patch={patch} canPick={myTurn} />
    </>
  );
}

/* ---------- Matchups: build fixtures, log winners ---------- */
/* Group-stage round robin is generated; knockout fixtures are logged manually
   since the bracket depends on results. We surface all 72 group games. */

// Each group's three matchday dates (2026). MD1/MD2/MD3.
const GROUP_DATES = {
  A: ["2026-06-11", "2026-06-18", "2026-06-24"],
  B: ["2026-06-12", "2026-06-18", "2026-06-24"],
  C: ["2026-06-13", "2026-06-19", "2026-06-24"],
  D: ["2026-06-12", "2026-06-19", "2026-06-25"],
  E: ["2026-06-14", "2026-06-20", "2026-06-25"],
  F: ["2026-06-14", "2026-06-20", "2026-06-25"],
  G: ["2026-06-15", "2026-06-21", "2026-06-26"],
  H: ["2026-06-15", "2026-06-21", "2026-06-26"],
  I: ["2026-06-16", "2026-06-22", "2026-06-26"],
  J: ["2026-06-16", "2026-06-22", "2026-06-27"],
  K: ["2026-06-17", "2026-06-23", "2026-06-27"],
  L: ["2026-06-17", "2026-06-23", "2026-06-27"],
};
// In a 4-team round robin, which matchday each (i,j) pairing belongs to.
const PAIR_MATCHDAY = { "0-1": 0, "2-3": 0, "0-2": 1, "1-3": 1, "0-3": 2, "1-2": 2 };

function groupStageFixtures() {
  const games = [];
  for (const [gr, teams] of Object.entries(GROUPS)) {
    for (let i = 0; i < teams.length; i++)
      for (let j = i + 1; j < teams.length; j++) {
        const md = PAIR_MATCHDAY[`${i}-${j}`];
        games.push({ id: `group-${gr}-${i}-${j}`, stage: "group",
          home: teams[i], away: teams[j], group: gr,
          date: GROUP_DATES[gr][md] });
      }
  }
  return games;
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
const RIVAL = {
  beatYourRival: 6,   // your team beats a team your rival owns
  beatYourHater: 2,   // your team beats a team owned by someone who picked you as rival
  perRound: 2,        // ± per knockout round based on rival's survival
  ownBothFinalists: 10,
  speedFastest: 1,
  speedSlowest: -1,
  latePenalty: -1,    // last player to accept the invite
};
const KO_STAGES = ["r32", "r16", "qf", "sf", "final"]; // ascending depth

// Is the draft board open for picking?
function draftIsOpen(g) {
  if (g.mode === "inperson") return g.inPersonReady;
  if (g.started) return true;
  if (g.scheduledStart && Date.now() >= g.scheduledStart) return true;
  return false;
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

function computeStandings(g) {
  const rosterSize = {};
  g.players.forEach((p) => { rosterSize[p.id] = g.picks.filter((x) => x.playerId === p.id).length; });
  const ownerOf = (team) => g.picks.find((p) => p.team === team)?.playerId;
  const teamsOf = (pid) => g.picks.filter((x) => x.playerId === pid).map((x) => x.team);
  const stagePts = (k) => g.points[k] ?? DEFAULT_POINTS[k];
  const rivals = g.rivals || {};
  // reverse map: who picked ME as their rival
  const haters = {};
  g.players.forEach((p) => { haters[p.id] = []; });
  Object.entries(rivals).forEach(([pid, rid]) => { if (haters[rid]) haters[rid].push(pid); });

  const raw = {}, wins = {}, themeB = {}, rivalB = {}, elimB = {}, finalB = {}, speedB = {};
  g.players.forEach((p) => {
    raw[p.id] = wins[p.id] = themeB[p.id] = rivalB[p.id] = elimB[p.id] = finalB[p.id] = speedB[p.id] = 0;
  });
  const theme = THEMES[g.theme] || THEMES[DEFAULT_THEME];

  const ko = g.koGames || [];
  const allGames = [...groupStageFixtures(), ...ko];
  for (const game of allGames) {
    const w = g.results[game.id];
    if (!w) continue;
    const own = ownerOf(w);
    if (!own) continue;
    raw[own] += stagePts(game.stage);
    wins[own] += 1;
    const loser = game.home === w ? game.away : game.home;
    themeB[own] += theme.bonus(loser, w);
    // rival bonuses: did the winner's owner beat their rival / a hater?
    const loserOwner = ownerOf(loser);
    if (loserOwner) {
      if (rivals[own] === loserOwner) rivalB[own] += RIVAL.beatYourRival;
      if ((haters[own] || []).includes(loserOwner)) rivalB[own] += RIVAL.beatYourHater;
    }
  }

  // Which teams reached each knockout round (appeared in a game of that stage)
  const reachedTeams = {}; // stage -> Set(team)
  KO_STAGES.forEach((s) => { reachedTeams[s] = new Set(); });
  for (const game of ko) {
    if (reachedTeams[game.stage]) {
      reachedTeams[game.stage].add(game.home);
      reachedTeams[game.stage].add(game.away);
    }
  }
  // Rival elimination ladder: for each KO round that has begun (has any game),
  // +perRound if rival has no team in it, -perRound if rival has a team in it.
  for (const [pid, rid] of Object.entries(rivals)) {
    if (!rid) continue;
    const rTeams = new Set(teamsOf(rid));
    for (const s of KO_STAGES) {
      if (reachedTeams[s].size === 0) continue; // round not started, skip
      const alive = [...rTeams].some((t) => reachedTeams[s].has(t));
      elimB[pid] += alive ? -RIVAL.perRound : RIVAL.perRound;
    }
  }

  // Own both finalists
  if (reachedTeams.final.size >= 2) {
    const finalists = [...reachedTeams.final];
    const owners = finalists.map(ownerOf);
    if (owners[0] && owners[0] === owners[1]) finalB[owners[0]] += RIVAL.ownBothFinalists;
  }

  // Draft speed: fastest total time +1, slowest -1 (needs all players timed & draft done)
  const dt = g.draftTime || {};
  const drafted = g.picks.length === ALL_TEAMS.length;
  const timed = g.players.filter((p) => dt[p.id] != null);
  if (drafted && timed.length === g.players.length && g.players.length >= 2) {
    let fast = timed[0], slow = timed[0];
    for (const p of timed) {
      if (dt[p.id] < dt[fast.id]) fast = p;
      if (dt[p.id] > dt[slow.id]) slow = p;
    }
    if (fast.id !== slow.id) {
      speedB[fast.id] += RIVAL.speedFastest;
      speedB[slow.id] += RIVAL.speedSlowest;
    }
  }

  // Unfashionably late: last player to accept the invite gets -1 (remote only).
  const lateB = {};
  g.players.forEach((p) => { lateB[p.id] = 0; });
  if (g.mode !== "inperson" && draftIsOpen(g)) {
    const lid = lastAccepter(g);
    // only penalize if more than one person accepted (a sole accepter isn't "late")
    if (lid && Object.keys(g.accepted || {}).length >= 2) lateB[lid] += RIVAL.latePenalty;
  }

  return g.players.map((p) => {
    const size = rosterSize[p.id] || 1;
    const mult = ALL_TEAMS.length / size;
    const scaled = raw[p.id] * mult;
    const bonus = themeB[p.id] + rivalB[p.id] + elimB[p.id] + finalB[p.id]
      + speedB[p.id] + lateB[p.id];
    return {
      id: p.id, name: p.name, roster: size, wins: wins[p.id],
      raw: raw[p.id], bonus,
      themeB: themeB[p.id], rivalB: rivalB[p.id], elimB: elimB[p.id],
      finalB: finalB[p.id], speedB: speedB[p.id], lateB: lateB[p.id],
      total: Math.round((scaled + bonus) * 10) / 10,
      mult: Math.round(mult * 100) / 100,
    };
  }).sort((a, b) => b.total - a.total);
}
function StandingsTab({ g, highlightId }) {
  const rows = useMemo(() => computeStandings(g), [g]);
  const leader = rows[0]?.total || 0;
  const theme = THEMES[g.theme] || THEMES[DEFAULT_THEME];
  return (
    <>
      <div style={{ ...card, padding: "12px 14px", marginBottom: 14,
        borderColor: S.accent, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 18 }}>⭐</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{theme.label}</div>
          <div style={{ fontSize: 12.5, opacity: 0.6, marginTop: 2, lineHeight: 1.4 }}>
            {theme.blurb} <span style={{ opacity: 0.8 }}>(+{theme.amount} each)</span>
          </div>
        </div>
      </div>
      <p style={{ fontSize: 13, opacity: 0.55, margin: "0 0 16px", lineHeight: 1.5 }}>
        Total = (win points × 48 ÷ roster size) + bonuses. Tap a player for the breakdown.
      </p>
      {rows.map((r, i) => {
        const chips = [];
        if (r.themeB) chips.push(["twist", r.themeB]);
        if (r.rivalB) chips.push(["rival", r.rivalB]);
        if (r.elimB) chips.push(["rival KO", r.elimB]);
        if (r.finalB) chips.push(["both finalists", r.finalB]);
        if (r.speedB) chips.push([r.speedB > 0 ? "fastest draft" : "slowest draft", r.speedB]);
        if (r.lateB) chips.push(["late to accept", r.lateB]);
        const barPct = leader > 0 ? Math.max(0, (r.total / leader) * 100) : 0;
        return (
        <div key={r.id} style={{ ...card, marginBottom: 8, display: "flex",
          alignItems: "center", gap: 14,
          borderColor: r.id === highlightId ? S.accent : "#222d47",
          background: r.id === highlightId ? S.card2 : S.card }}>
          <div style={{ fontSize: 22, fontWeight: 800, width: 28, textAlign: "center",
            color: i === 0 ? S.accent : S.ink, opacity: i === 0 ? 1 : 0.4 }}>
            {i === 0 ? "🥇" : i + 1}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{r.name}</div>
            <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>
              {r.wins} wins · {r.roster} teams · ×{r.mult}
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
          <div style={{ fontWeight: 800, fontSize: 22, fontVariantNumeric: "tabular-nums",
            color: r.total < 0 ? "#ff8095" : S.ink }}>
            {r.total}
          </div>
        </div>
        );
      })}
    </>
  );
}

/* ---------- Player dashboard: Roster / Upcoming / Standings ---------- */
function fmtDate(iso) {
  if (!iso) return "TBD";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
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

/* Phase 3a: one-time rules gate before a player's first pick */
function RulesGate({ g, onStart, onBack }) {
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
      <Header title={g.name} onBack={onBack} sub="How scoring works" />

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
          <li>After the draft you pick a <strong>rival</strong> — beat them for bonus points.</li>
          <li>The <strong>fastest</strong> overall drafter earns +{RIVAL.speedFastest}, the
            slowest loses {Math.abs(RIVAL.speedSlowest)}. Don't dawdle on your picks.</li>
        </ul>
      </div>

      <button className="primary" onClick={onStart} style={{ width: "100%" }}>
        Got it — start my pick →
      </button>
      <p style={{ fontSize: 12, opacity: 0.45, textAlign: "center", marginTop: 8 }}>
        Your pick clock starts when you tap.
      </p>
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
      <button className="primary" onClick={onStart}
        style={{ width: "100%", maxWidth: 360, padding: 16, fontSize: 17 }}>
        Make my pick →
      </button>
      <button className="ghost" onClick={onBack}
        style={{ marginTop: 10, fontSize: 13 }}>Back</button>
    </div>
  );
}
function PlayerView({ id, phone, playerId, onBack }) {
  const [page, setPage] = useState("roster");
  const [showHistory, setShowHistory] = useState(false);
  const [ackedPick, setAckedPick] = useState(-1); // last pickIdx the player tapped "YOU'RE UP" for
  const { g, notFound: missing, save, patch } = usePolledGroup(id);

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
    await patch({ op: "setRival", playerId: me.id, rivalId });
  }
  async function accept() {
    if ((g.accepted || {})[me.id]) return;
    await patch({ op: "accept", playerId: me.id });
  }
  async function markRulesSeen() {
    await patch({ op: "seenRules", playerId: me.id });
  }

  // PHASE 1: remote, not yet accepted -> accept screen
  if (g.mode !== "inperson" && !accepted && !drafted) {
    return <AcceptInvite g={g} me={me} onBack={onBack} onAccept={accept} />;
  }
  // PHASE 2: accepted but draft not open yet -> waiting lobby
  if (!open && !drafted) {
    return <WaitingLobby g={g} me={me} onBack={onBack} pname={pname} />;
  }
  // PHASE 3: draft is open and not finished -> live draft on your phone
  if (open && !drafted) {
    const myTurn = g.order[g.pickIdx] === g.players.findIndex((p) => p.id === me?.id);
    // rules gate before first pick
    if (myTurn && !seenRules) {
      return <RulesGate g={g} onStart={markRulesSeen} onBack={onBack} />;
    }
    // "YOU'RE UP!" gate at the start of each of this player's turns
    if (myTurn && seenRules && ackedPick !== g.pickIdx) {
      return <YoureUp g={g} me={me} onStart={() => setAckedPick(g.pickIdx)} onBack={onBack} />;
    }
    return (
      <LiveDraft g={g} me={me} save={save} patch={patch} onBack={onBack}
        myTurn={myTurn} pname={pname} />
    );
  }

  // PHASE 4: draft done -> dashboard
  return (
    <>
      <Header title={g.name} onBack={onBack} sub={`Playing as ${me?.name}`}
        right={<button className="ghost" onClick={() => setShowHistory(true)}
          style={{ marginTop: 4, fontSize: 13 }}>Draft log</button>} />
      <RivalPicker g={g} me={me} onSet={setRival} pname={pname} />
      <nav style={{ display: "flex", gap: 5, marginBottom: 18 }}>
        {[["roster", "Roster"], ["upcoming", "Upcoming"],
          ["rivals", "Competition"], ["standings", "Standings"]]
          .map(([k, l]) => (
            <button key={k} onClick={() => setPage(k)}
              className={page === k ? "tab on" : "tab"}
              style={{ fontSize: 12.5, padding: "10px 3px" }}>{l}</button>
          ))}
      </nav>
      {page === "roster" && <PlayerRoster g={g} myTeams={myTeams} />}
      {page === "upcoming" && (
        <PlayerUpcoming g={g} myTeamSet={myTeamSet} ownerOf={ownerOf} pname={pname} meId={me?.id} />
      )}
      {page === "rivals" && <PlayerRivals g={g} meId={me?.id} />}
      {page === "standings" && <StandingsTab g={g} highlightId={me?.id} />}
      {showHistory && <DraftHistory g={g} onClose={() => setShowHistory(false)} />}
    </>
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
            +{RIVAL.beatYourRival} whenever your team beats theirs, +{RIVAL.perRound} each
            knockout round they're out, −{RIVAL.perRound} each round they survive.
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
              style={{ fontSize: 13, padding: "8px 12px", flex: "none" }}>Draft order</button>
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
      <span style={{ minWidth: 42, fontWeight: 800, fontSize: 14,
        color: typeof pts === "number" && pts < 0 ? "#ff8095" : S.accent,
        fontVariantNumeric: "tabular-nums" }}>
        {typeof pts === "number" && pts > 0 ? "+" : ""}{pts}
      </span>
      <span style={{ fontSize: 13, lineHeight: 1.45, opacity: 0.85 }}>{children}</span>
    </div>
  );
  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ ...lbl, marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div>
      <Section title="Win points (per game won)">
        {STAGES.map((s) => (
          <Rule key={s.key} pts={g.points?.[s.key] ?? s.pts}>{s.label}</Rule>
        ))}
        <p style={{ fontSize: 12, opacity: 0.5, marginTop: 8, lineHeight: 1.5 }}>
          Win points are then scaled by 48 ÷ (teams you drafted), so a smaller roster
          earns more per win.
        </p>
      </Section>

      <Section title={`Twist: ${theme.label}`}>
        <Rule pts={theme.amount}>{theme.blurb}</Rule>
      </Section>

      <Section title="Rivals">
        <Rule pts={RIVAL.beatYourRival}>Your team beats a team your rival drafted.</Rule>
        <Rule pts={RIVAL.beatYourHater}>Your team beats a team owned by someone who picked you as their rival.</Rule>
        <Rule pts={RIVAL.perRound}>Each knockout round your rival has no team left in.</Rule>
        <Rule pts={-RIVAL.perRound}>Each knockout round your rival still has a team alive.</Rule>
        <p style={{ fontSize: 12, opacity: 0.5, marginTop: 8, lineHeight: 1.5 }}>
          Rivals are chosen after the draft and locked permanently. A player everyone
          targets collects penalties from each of them, but is fought over all tournament.
        </p>
      </Section>

      <Section title="Final">
        <Rule pts={RIVAL.ownBothFinalists}>You drafted both teams in the final.</Rule>
      </Section>

      <Section title="Draft speed">
        <Rule pts={RIVAL.speedFastest}>Fastest total draft time across all your picks.</Rule>
        <Rule pts={RIVAL.speedSlowest}>Slowest total draft time.</Rule>
      </Section>

      {g.mode !== "inperson" && (
        <Section title="Invitations">
          <Rule pts={RIVAL.latePenalty}>Last player to accept the invite (unfashionably late).</Rule>
        </Section>
      )}
    </div>
  );
}

function PlayerRoster({ g, myTeams }) {
  const results = g.results || {};
  const allGames = [...groupStageFixtures(), ...(g.koGames || [])];
  const teamWins = (team) => allGames.filter((gm) =>
    results[gm.id] === team).length;
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
        const w = teamWins(team);
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
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{w}</div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>wins</div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function PlayerRivals({ g, meId }) {
  const results = g.results || {};
  const allGames = [...groupStageFixtures(), ...(g.koGames || [])];
  const teamWins = (team) => allGames.filter((gm) => results[gm.id] === team).length;

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
                      <div key={team} style={{ display: "flex", alignItems: "center", gap: 7,
                        background: S.card2, borderRadius: 9, padding: "7px 9px" }}>
                        <span style={{ fontSize: 15 }}>{FLAG[team]}</span>
                        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {team}
                        </span>
                        {teamWins(team) > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: S.accent }}>
                            {teamWins(team)}W
                          </span>
                        )}
                      </div>
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

function PlayerUpcoming({ g, myTeamSet, ownerOf, pname, meId }) {
  const results = g.results || {};
  // group-stage fixtures have dates; knockout games are dated by stage order if no date.
  const games = [...groupStageFixtures(), ...(g.koGames || [])]
    .filter((gm) => myTeamSet.has(gm.home) || myTeamSet.has(gm.away))
    .filter((gm) => !results[gm.id]); // not yet decided

  // sort by date (undated knockout games sink to bottom)
  games.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));

  if (games.length === 0) return (
    <div style={{ ...card, textAlign: "center" }}>
      <div style={{ fontSize: 26 }}>🎉</div>
      <p style={{ fontWeight: 700, marginTop: 6 }}>No games pending</p>
      <p style={{ opacity: 0.55, fontSize: 13 }}>
        Every game involving your teams has a result, or none are scheduled yet.
      </p>
    </div>
  );

  const stageLabel = (k) => STAGES.find((s) => s.key === k)?.label || k;
  return (
    <>
      <p style={{ fontSize: 13, opacity: 0.55, margin: "0 0 14px" }}>
        Next games involving your teams. Bold side is yours.
      </p>
      {games.map((gm, i) => {
        const hMine = myTeamSet.has(gm.home), aMine = myTeamSet.has(gm.away);
        const headToHead = ownerOf(gm.home) && ownerOf(gm.away)
          && ownerOf(gm.home) !== ownerOf(gm.away)
          && (hMine || aMine);
        const youOwnBoth = hMine && aMine;
        return (
          <div key={gm.id} style={{ ...card, padding: "12px 14px", marginBottom: 8,
            borderColor: i === 0 ? S.accent : "#222d47" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, opacity: 0.5, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {stageLabel(gm.stage)}{gm.group ? ` · Group ${gm.group}` : ""}
              </span>
              <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 600 }}>{fmtDate(gm.date)}</span>
            </div>
            <Side team={gm.home} mine={hMine} owner={ownerOf(gm.home)} pname={pname} />
            <div style={{ textAlign: "center", fontSize: 11, opacity: 0.35, margin: "2px 0" }}>vs</div>
            <Side team={gm.away} mine={aMine} owner={ownerOf(gm.away)} pname={pname} />
            {youOwnBoth && <Tag text="you own both — no head-to-head" />}
            {headToHead && !youOwnBoth && <Tag text={`head-to-head vs ${
              pname(ownerOf(hMine ? gm.away : gm.home))}`} accent />}
          </div>
        );
      })}
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
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;
