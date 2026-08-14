import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: dashboard, error: dashError } = await supabase
    .from("dashboards")
    .select("id, name, created_at, updated_at")
    .eq("id", id)
    .single();
  if (dashError || !dashboard) return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });

  const { data: blocks, error: blockError } = await supabase
    .from("dashboard_blocks")
    .select("id, title, source_question, stats, computed_at, position")
    .eq("dashboard_id", id)
    .order("position", { ascending: true });
  if (blockError) return NextResponse.json({ error: blockError.message }, { status: 500 });

  return NextResponse.json({
    dashboard: { id: dashboard.id, name: dashboard.name, createdAt: dashboard.created_at, updatedAt: dashboard.updated_at },
    blocks: (blocks ?? []).map((b: any) => ({
      id: b.id,
      title: b.title,
      sourceQuestion: b.source_question,
      stats: b.stats,
      computedAt: b.computed_at,
      position: b.position,
    })),
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("dashboards").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
