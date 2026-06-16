import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/groups/:id -> { group }
export async function GET(_request, { params }) {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("groups")
    .select("data").eq("id", params.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ group: null }, { status: 404 });
  return NextResponse.json({ group: data.data });
}

// PUT /api/groups/:id  { group } -> replaces the row
export async function PUT(request, { params }) {
  const sb = supabaseAdmin();
  const body = await request.json();
  const group = body.group;
  if (!group) return NextResponse.json({ error: "group required" }, { status: 400 });
  const { error } = await sb.from("groups").upsert({ id: params.id, data: group });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/groups/:id -> remove the group
export async function DELETE(_request, { params }) {
  const sb = supabaseAdmin();
  const { error } = await sb.from("groups").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH /api/groups/:id  { op, ... } -> read-modify-write ONE field atomically.
// This avoids whole-object overwrites racing between phones. Each op reads the
// freshest row, applies a minimal change, and writes it back.
export async function PATCH(request, { params }) {
  const sb = supabaseAdmin();
  const body = await request.json();
  const { op } = body;

  const { data: row, error: readErr } = await sb.from("groups")
    .select("data").eq("id", params.id).maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  const g = row.data;

  if (op === "accept") {
    const { playerId } = body;
    g.accepted = g.accepted || {};
    if (!g.accepted[playerId]) g.accepted[playerId] = Date.now();
  } else if (op === "setRival") {
    const { playerId, rivalId } = body;
    g.rivals = g.rivals || {};
    if (!g.rivals[playerId]) g.rivals[playerId] = rivalId; // locked once set
  } else if (op === "seenRules") {
    const { playerId } = body;
    g.seenRules = g.seenRules || {};
    g.seenRules[playerId] = true;
  } else if (op === "draftReady") {
    const { playerId } = body;
    g.draftReady = g.draftReady || {};
    if (!g.draftReady[playerId]) g.draftReady[playerId] = Date.now();
  } else if (op === "lastLogin") {
    // record the most recent time a player opened the app (for login-based awards)
    const { playerId } = body;
    g.lastLogin = g.lastLogin || {};
    g.lastLogin[playerId] = Date.now();
  } else if (op === "pick") {
    // Append a draft pick, but only if it's still this player's turn and the
    // team isn't taken. Guards against double-taps and two phones racing.
    const { playerId, team, group: grp, secs } = body;
    const taken = new Set((g.picks || []).map((p) => p.team));
    const turnPlayerIdx = g.order[g.pickIdx];
    const turnPlayerId = g.players[turnPlayerIdx]?.id;
    if (turnPlayerId !== playerId) {
      return NextResponse.json({ group: g, rejected: "not your turn" });
    }
    if (taken.has(team)) {
      return NextResponse.json({ group: g, rejected: "team taken" });
    }
    g.picks = g.picks || [];
    g.picks.push({ team, group: grp, playerId, secs: Math.round((secs || 0) * 10) / 10, at: Date.now() });
    g.pickIdx = (g.pickIdx || 0) + 1;
    g.draftTime = g.draftTime || {};
    g.draftTime[playerId] = (g.draftTime[playerId] || 0) + (secs || 0);
  } else if (op === "launch") {
    g.started = true;
  } else if (op === "inPersonReady") {
    g.inPersonReady = true;
  } else if (op === "setResult") {
    // winner may be a goal object {h,a,w}, a team-name string, or null to clear.
    const { matchId, winner } = body;
    g.results = g.results || {};
    if (winner === null) delete g.results[matchId];
    else g.results[matchId] = winner;
  } else {
    return NextResponse.json({ error: "unknown op" }, { status: 400 });
  }

  const { error: writeErr } = await sb.from("groups").upsert({ id: params.id, data: g });
  if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 500 });
  return NextResponse.json({ group: g });
}
