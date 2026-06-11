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
