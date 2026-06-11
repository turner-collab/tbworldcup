import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/groups -> [{ id, name, players, phase }]  (lightweight index)
// GET /api/groups?phone=NNN -> { groups: [{id,name}], matched: bool } for login
export async function GET(request) {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("groups").select("id, data");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const url = new URL(request.url);
  const phone = url.searchParams.get("phone");
  if (phone) {
    const np = normPhone(phone);
    const groups = (data || []).filter((row) => {
      const players = (row.data || {}).players || [];
      return players.some((p) => normPhone(p.phone) === np);
    }).map((row) => ({ id: row.id, name: (row.data || {}).name }));
    return NextResponse.json({ groups, matched: groups.length > 0 });
  }

  const index = (data || []).map((row) => {
    const g = row.data || {};
    const drafted = (g.picks || []).length === 48;
    const open = draftIsOpen(g);
    return {
      id: row.id,
      name: g.name,
      players: (g.players || []).length,
      phase: drafted ? "Live" : open ? "Drafting" : "Lobby",
    };
  });
  return NextResponse.json({ index });
}

function normPhone(s) {
  return (s || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
}

// POST /api/groups  { group }  -> creates/replaces the row
export async function POST(request) {
  const sb = supabaseAdmin();
  const body = await request.json();
  const group = body.group;
  if (!group || !group.id) {
    return NextResponse.json({ error: "group with id required" }, { status: 400 });
  }
  const { error } = await sb.from("groups").upsert({ id: group.id, data: group });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

function draftIsOpen(g) {
  if (g.mode === "inperson") return !!g.inPersonReady;
  if (g.started) return true;
  if (g.scheduledStart && Date.now() >= g.scheduledStart) return true;
  return false;
}
