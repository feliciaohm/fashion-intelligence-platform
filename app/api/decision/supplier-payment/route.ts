import { NextResponse } from "next/server";
import { getSupplierPaymentSummary } from "@/lib/supplier-payment-server";

export async function GET() {
  try {
    const summary = await getSupplierPaymentSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
