import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";
import { COUNTRY_TO_ISO, normalizeCountry, safeDivide, detectOutliers, type NormalizationChange } from "@/lib/data-quality";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

export async function GET() {
  try {
    const [
      [shopifyDupes],
      [salesEventDupes],
      [influencerDupes],
      [nullGiftedCostRows],
      [giftedCostAgg],
      [purchaseRows],
      [countryRows],
    ] = await Promise.all([
      // 1. Duplicate detection -- same order_id in shopify_orders
      bigquery.query(`
        WITH grouped AS (
          SELECT order_id, COUNT(*) AS c FROM \`${PROJECT}.shopify_orders\` GROUP BY order_id
        )
        SELECT (SELECT COUNT(*) FROM \`${PROJECT}.shopify_orders\`) AS total_records,
               SUM(GREATEST(c - 1, 0)) AS duplicate_records,
               COUNTIF(c > 1) AS duplicate_groups
        FROM grouped
      `),
      // same timestamp + visitor (customer) + event combination in sales_events
      bigquery.query(`
        WITH grouped AS (
          SELECT user_pseudo_id, event_timestamp, event_name, COUNT(*) AS c
          FROM \`${PROJECT}.sales_events\` GROUP BY user_pseudo_id, event_timestamp, event_name
        )
        SELECT (SELECT COUNT(*) FROM \`${PROJECT}.sales_events\`) AS total_records,
               SUM(GREATEST(c - 1, 0)) AS duplicate_records,
               COUNTIF(c > 1) AS duplicate_groups
        FROM grouped
      `),
      // same influencer + product + post date in influencer_product_performance
      bigquery.query(`
        WITH grouped AS (
          SELECT influencer, product_slug, post_date, COUNT(*) AS c
          FROM \`${PROJECT}.influencer_product_performance\` GROUP BY influencer, product_slug, post_date
        )
        SELECT (SELECT COUNT(*) FROM \`${PROJECT}.influencer_product_performance\`) AS total_records,
               SUM(GREATEST(c - 1, 0)) AS duplicate_records,
               COUNTIF(c > 1) AS duplicate_groups
        FROM grouped
      `),
      // 2. Null handling -- campaigns with unknown gifted cost
      bigquery.query(`
        SELECT influencer, product_slug, post_date, total_revenue, purchases
        FROM \`${PROJECT}.influencer_product_performance\`
        WHERE gifted_cost IS NULL
        ORDER BY post_date DESC
      `),
      bigquery.query(`
        SELECT SUM(gifted_cost) AS total_cost, SUM(total_revenue) AS total_revenue, COUNT(*) AS n
        FROM \`${PROJECT}.influencer_product_performance\`
        WHERE gifted_cost IS NOT NULL
      `),
      // 3. Outlier detection -- real purchase-level revenue
      bigquery.query(`
        SELECT user_pseudo_id, event_timestamp, product_slug, country, revenue
        FROM \`${PROJECT}.sales_events\`
        WHERE event_name = 'purchase' AND revenue > 0
      `),
      // 4. Normalization -- every distinct real country value in use, with a row count per table
      bigquery.query(`
        SELECT country, 'sales_events' AS source_table, COUNT(*) AS n
        FROM \`${PROJECT}.sales_events\` WHERE country IS NOT NULL GROUP BY country
        UNION ALL
        SELECT country, 'crm_customers', COUNT(*) FROM \`${PROJECT}.crm_customers\` WHERE country IS NOT NULL GROUP BY country
        UNION ALL
        SELECT country, 'influencer_product_performance', COUNT(*) FROM \`${PROJECT}.influencer_product_performance\` WHERE country IS NOT NULL GROUP BY country
        UNION ALL
        SELECT country, 'store_performance', COUNT(*) FROM \`${PROJECT}.store_performance\` WHERE country IS NOT NULL GROUP BY country
      `),
    ]);

    // ---- 1. Duplicates ----
    const duplicates = {
      shopify_orders: {
        table: "shopify_orders",
        key: "order_id",
        totalRecords: shopifyDupes[0]?.total_records ?? 0,
        duplicateRecords: Number(shopifyDupes[0]?.duplicate_records ?? 0),
        duplicateGroups: Number(shopifyDupes[0]?.duplicate_groups ?? 0),
      },
      sales_events: {
        table: "sales_events",
        key: "user_pseudo_id + event_timestamp + event_name",
        totalRecords: salesEventDupes[0]?.total_records ?? 0,
        duplicateRecords: Number(salesEventDupes[0]?.duplicate_records ?? 0),
        duplicateGroups: Number(salesEventDupes[0]?.duplicate_groups ?? 0),
      },
      influencer_product_performance: {
        table: "influencer_product_performance",
        key: "influencer + product_slug + post_date",
        totalRecords: influencerDupes[0]?.total_records ?? 0,
        duplicateRecords: Number(influencerDupes[0]?.duplicate_records ?? 0),
        duplicateGroups: Number(influencerDupes[0]?.duplicate_groups ?? 0),
      },
    };
    const totalDuplicateRecords =
      duplicates.shopify_orders.duplicateRecords +
      duplicates.sales_events.duplicateRecords +
      duplicates.influencer_product_performance.duplicateRecords;

    // ---- 2. Null handling ----
    const costUnknownCampaigns = nullGiftedCostRows;
    const costKnownCount = giftedCostAgg[0]?.n ?? 0;
    const blendedRoi = safeDivide(
      (giftedCostAgg[0]?.total_revenue ?? 0) - (giftedCostAgg[0]?.total_cost ?? 0),
      giftedCostAgg[0]?.total_cost ?? 0
    );
    const blendedRoiPct = typeof blendedRoi === "number" ? Math.round(blendedRoi * 1000) / 10 : blendedRoi;

    // ---- 3. Outliers ----
    const outlierResult = detectOutliers(purchaseRows, (r: any) => r.revenue, 3);
    const totalWithOutliers = purchaseRows.reduce((s: number, r: any) => s + r.revenue, 0);
    const totalWithoutOutliers = outlierResult.normal.reduce((s: number, r: any) => s + r.value, 0);

    // ---- 4. Normalization ----
    const changesByCountry: Record<string, NormalizationChange> = {};
    countryRows.forEach((r: any) => {
      const iso = normalizeCountry(r.country);
      if (iso !== r.country) {
        const key = r.country;
        if (!changesByCountry[key]) {
          changesByCountry[key] = { field: "country", from: r.country, to: iso, recordCount: 0 };
        }
        changesByCountry[key].recordCount += r.n;
      }
    });
    const normalizationLog = Object.values(changesByCountry).sort((a, b) => b.recordCount - a.recordCount);
    const totalCountryValuesChecked = countryRows.length;
    const totalRecordsNormalized = normalizationLog.reduce((s, c) => s + c.recordCount, 0);

    return NextResponse.json({
      duplicates: {
        byTable: duplicates,
        totalDuplicateRecords,
      },
      nulls: {
        costUnknownCampaigns,
        costUnknownCount: costUnknownCampaigns.length,
        costKnownCount,
        blendedRoiPct,
      },
      outliers: {
        mean: outlierResult.mean,
        stddev: outlierResult.stddev,
        threshold: outlierResult.threshold,
        sigmaUsed: outlierResult.sigmaUsed,
        outliers: outlierResult.outliers,
        totalOrders: purchaseRows.length,
        totalWithOutliers,
        totalWithoutOutliers,
      },
      normalization: {
        log: normalizationLog,
        totalCountryValuesChecked,
        totalRecordsNormalized,
        currencyChangesFound: 0,
        isoMap: COUNTRY_TO_ISO,
      },
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
