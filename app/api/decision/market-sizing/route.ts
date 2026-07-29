import { NextResponse } from "next/server";
import { computeMarketSizing } from "@/lib/market-sizing-server";

export async function POST(req: Request) {
  const { country, category, pricePoint } = await req.json();

  if (!country || !category || !pricePoint) {
    return NextResponse.json({ error: "country, category, and pricePoint are required" }, { status: 400 });
  }

  try {
    const result = await computeMarketSizing({ country, category, pricePoint: Number(pricePoint) });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("No reference population")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json(
      { error: "BigQuery failed", details: String(error) },
      { status: 500 }
    );
  }
}
