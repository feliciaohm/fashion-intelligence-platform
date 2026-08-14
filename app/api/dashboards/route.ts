import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Session-scoped client (not service-role) -- RLS does the actual scoping
// to the logged-in user, the same pattern every other authenticated route
// in this app uses. proxy.ts already guarantees a session exists before
// this route runs at all.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("dashboards")
    .select("id, name, created_at, updated_at, dashboard_blocks(count)")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const dashboards = (data ?? []).map((d: any) => ({
    id: d.id,
    name: d.name,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    blockCount: d.dashboard_blocks?.[0]?.count ?? 0,
  }));

  return NextResponse.json({ dashboards });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "A dashboard name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("dashboards")
    .insert({ owner_id: user.id, name: name.trim() })
    .select("id, name, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ dashboard: { id: data.id, name: data.name, createdAt: data.created_at, updatedAt: data.updated_at } });
}
