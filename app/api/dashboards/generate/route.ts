import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateDashboardBlocks } from "@/lib/dashboard-generator";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt } = await req.json();
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "Describe the dashboard you want" }, { status: 400 });
  }

  try {
    const blocks = await generateDashboardBlocks(prompt.trim());
    if (blocks.length === 0) {
      return NextResponse.json(
        { error: "Couldn't find any real, answerable questions matching that description." },
        { status: 400 }
      );
    }

    const { data: dashboard, error: createError } = await supabase
      .from("dashboards")
      .insert({ owner_id: user.id, name: prompt.trim().slice(0, 80) })
      .select("id")
      .single();
    if (createError) throw new Error(createError.message);

    const { error: blocksError } = await supabase.from("dashboard_blocks").insert(
      blocks.map((b, i) => ({
        dashboard_id: dashboard.id,
        title: b.title,
        source_question: b.sourceQuestion,
        stats: b.stats,
        position: i,
      }))
    );
    if (blocksError) throw new Error(blocksError.message);

    return NextResponse.json({ dashboardId: dashboard.id, blockCount: blocks.length });
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate dashboard", details: String(error) }, { status: 500 });
  }
}
