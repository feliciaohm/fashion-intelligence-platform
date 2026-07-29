import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";
import { PROJECT, TIME_PERIODS } from "@/lib/intelligence";

export async function GET() {
  try {
    const [
      [influencerRows],
      [productRows],
      [countryRows],
      [channelRows],
      [departmentRows],
    ] = await Promise.all([
      bigquery.query(
        `SELECT DISTINCT influencer AS value FROM \`${PROJECT}.influencer_product_performance\` ORDER BY value`
      ),
      bigquery.query(
        `SELECT DISTINCT product_slug AS value, product_name AS label FROM \`${PROJECT}.product_lifecycle\` ORDER BY label`
      ),
      bigquery.query(`
        SELECT country FROM (
          SELECT DISTINCT country FROM \`${PROJECT}.influencer_product_performance\` WHERE country IS NOT NULL
          UNION DISTINCT
          SELECT DISTINCT country FROM \`${PROJECT}.crm_customers\` WHERE country IS NOT NULL
          UNION DISTINCT
          SELECT DISTINCT country FROM \`${PROJECT}.store_performance\` WHERE country IS NOT NULL
        ) ORDER BY country
      `),
      bigquery.query(
        `SELECT DISTINCT channel AS value FROM \`${PROJECT}.finance_channel_monthly\` ORDER BY value`
      ),
      bigquery.query(
        `SELECT DISTINCT name AS value FROM \`${PROJECT}.cost_centers\` ORDER BY value`
      ),
    ]);

    return NextResponse.json({
      influencer: influencerRows.map((r: any) => ({ value: r.value, label: r.value })),
      product: productRows.map((r: any) => ({ value: r.value, label: r.label })),
      country: countryRows.map((r: any) => ({ value: r.country, label: r.country })),
      channel: channelRows.map((r: any) => ({
        value: r.value,
        label: r.value[0].toUpperCase() + r.value.slice(1),
      })),
      department: departmentRows.map((r: any) => ({
        value: r.value,
        label: r.value.split("_").map((w: string) => w[0].toUpperCase() + w.slice(1)).join(" "),
      })),
      time_period: TIME_PERIODS.map((v) => ({ value: v, label: v })),
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json(
      { error: "BigQuery failed", details: String(error) },
      { status: 500 }
    );
  }
}
