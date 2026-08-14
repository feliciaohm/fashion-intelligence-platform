import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Adds one real, already-computed result to a saved dashboard -- e.g. a
// Command Center AI Search answer's stats. `stats` is stored exactly as
// received (real label/value pairs already computed elsewhere), never
// recomputed or estimated here. `computed_at` defaults to now() in the
// table, honestly marking when this snapshot was taken.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, sourceQuestion, stats } = await req.json();
  if (!title || !Array.isArray(stats) || stats.length === 0) {
    return NextResponse.json({ error: "A title and at least one stat are required" }, { status: 400 });
  }

  // Confirm ownership explicitly (RLS also enforces this, but a clear 404
  // beats a generic RLS-denied error for a dashboard that isn't yours or
  // doesn't exist).
  const { data: dashboard } = await supabase.from("dashboards").select("id").eq("id", id).maybeSingle();
  if (!dashboard) return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });

  const { count } = await supabase
    .from("dashboard_blocks")
    .select("id", { count: "exact", head: true })
    .eq("dashboard_id", id);

  const { data, error } = await supabase
    .from("dashboard_blocks")
    .insert({
      dashboard_id: id,
      title,
      source_question: sourceQuestion ?? null,
      stats,
      position: count ?? 0,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("dashboards").update({ updated_at: new Date().toISOString() }).eq("id", id);

  return NextResponse.json({ ok: true, blockId: data.id });
}
