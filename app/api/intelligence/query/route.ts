import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";
import { TARGETS, buildTargetQuery } from "@/lib/intelligence-server";
import { FilterTag } from "@/lib/intelligence";

export async function POST(req: Request) {
  const { filters } = (await req.json()) as { filters: FilterTag[] };

  if (!Array.isArray(filters) || filters.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const built = TARGETS.map((t) => buildTargetQuery(t, filters)).filter(
    (b): b is NonNullable<typeof b> => b !== null
  );

  try {
    const results = await Promise.all(
      built.map(async (b) => {
        const [rows] = await bigquery.query({ query: b.sql, params: b.params, types: b.types as any });
        return {
          label: b.label,
          columns: rows.length > 0 ? Object.keys(rows[0]) : [],
          rows,
        };
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json(
      { error: "BigQuery failed", details: String(error) },
      { status: 500 }
    );
  }
}
