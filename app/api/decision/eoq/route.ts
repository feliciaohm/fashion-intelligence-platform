import { NextResponse } from "next/server";
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";
// Not tracked anywhere in this dataset (no procurement/logistics-cost table
// exists) -- a documented planning assumption, typical for a small apparel
// wholesale/DTC reorder.
const ASSUMED_ORDER_COST_EUR = 150;
// Common inventory-costing convention: holding cost (capital tied up,
// storage, obsolescence risk) as a % of unit cost per year.
const ASSUMED_HOLDING_COST_RATE = 0.22;
// Documented "current practice" baseline to compare EOQ savings against,
// since no real reorder-cadence data exists for retail/online inventory in
// this dataset (only wholesale_orders tracks B2B order-level data, which is
// a different channel).
const ASSUMED_CURRENT_ORDERS_PER_YEAR = 12;

export async function POST(req: Request) {
  const { category } = await req.json();
  if (!category) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }

  try {
    const [rows] = await bigquery.query({
      query: `SELECT SUM(units_sold_direct) AS units, AVG(cost_price) AS avg_cost, COUNT(*) AS n
              FROM \`${PROJECT}.product_lifecycle\` WHERE category = @category`,
      params: { category },
      types: { category: "STRING" },
    });
    const [rangeRows] = await bigquery.query(
      `SELECT MIN(DATE(event_timestamp)) AS min_date, MAX(DATE(event_timestamp)) AS max_date FROM \`${PROJECT}.sales_events\``
    );
    const [supplierRows] = await bigquery.query({
      query: `SELECT supplier_name, lead_time_days, on_time_delivery_rate
              FROM \`${PROJECT}.suppliers\` WHERE product_category = @category
              ORDER BY lead_time_days ASC`,
      params: { category },
      types: { category: "STRING" },
    });

    const rawUnits = rows[0]?.units ?? 0;
    const avgCost = rows[0]?.avg_cost ?? 0;
    const productCount = rows[0]?.n ?? 0;
    if (rawUnits === 0) {
      return NextResponse.json({ error: `No real sales recorded for category "${category}" to base demand on.` }, { status: 400 });
    }

    const minDate = new Date(rangeRows[0]?.min_date?.value ?? rangeRows[0]?.min_date);
    const maxDate = new Date(rangeRows[0]?.max_date?.value ?? rangeRows[0]?.max_date);
    const observedDays = Math.max(1, Math.round((maxDate.getTime() - minDate.getTime()) / 86400000));
    const annualDemandUnits = Math.round(rawUnits * (365 / observedDays));

    const S = ASSUMED_ORDER_COST_EUR;
    const H = avgCost * ASSUMED_HOLDING_COST_RATE;

    const eoq = Math.sqrt((2 * annualDemandUnits * S) / H);
    const ordersPerYear = annualDemandUnits / eoq;
    const reorderIntervalDays = 365 / ordersPerYear;
    const totalCostAtEoq = Math.sqrt(2 * annualDemandUnits * S * H);

    const currentOrderQty = annualDemandUnits / ASSUMED_CURRENT_ORDERS_PER_YEAR;
    const currentOrderingCost = ASSUMED_CURRENT_ORDERS_PER_YEAR * S;
    const currentHoldingCost = (currentOrderQty / 2) * H;
    const currentTotalCost = currentOrderingCost + currentHoldingCost;

    const annualSavings = currentTotalCost - totalCostAtEoq;

    // Reorder point: real supplier lead-time data (suppliers.lead_time_days,
    // joined on product_category) tells you WHEN to reorder, which classic
    // EOQ (how MUCH to order) doesn't cover on its own. Uses the
    // fastest-lead-time supplier serving this category as the planning
    // reference, plus a safety-stock buffer sized to that supplier's real
    // on-time delivery rate -- a less reliable supplier needs a bigger
    // buffer for the same lead time, not a fixed padding percentage.
    const dailyDemand = annualDemandUnits / 365;
    const bestSupplier = supplierRows[0] ?? null;
    const reorderPoint = bestSupplier
      ? Math.round(dailyDemand * bestSupplier.lead_time_days * (1 + (1 - bestSupplier.on_time_delivery_rate / 100)))
      : null;

    const methodology = [
      `EOQ = √(2DS ÷ H). D (annual demand, ${annualDemandUnits.toLocaleString()} units) is real ${category} units sold direct-channel (product_lifecycle, ${productCount} products), annualized from the ${observedDays}-day window this dataset actually covers (${rawUnits} units observed × 365/${observedDays}).`,
      `S (order cost, €${S}/order) and the holding-cost rate (${(ASSUMED_HOLDING_COST_RATE * 100).toFixed(0)}% of unit cost/year) are documented planning assumptions — this dataset has no real procurement or logistics-cost table to derive them from. H itself (€${H.toFixed(2)}/unit/year) is that rate applied to the real average cost price for ${category} (€${avgCost.toFixed(2)}).`,
      `Optimal order quantity: ${Math.round(eoq).toLocaleString()} units, reordered ${ordersPerYear.toFixed(1)} times/year (every ${Math.round(reorderIntervalDays)} days).`,
      `"Current pattern" for comparison is assumed to be ${ASSUMED_CURRENT_ORDERS_PER_YEAR} orders/year (monthly reordering, a common baseline before EOQ optimization is applied) — also an assumption, since no real reorder-cadence data exists for this channel. Estimated annual savings from switching to the EOQ quantity: €${Math.round(annualSavings).toLocaleString()} (€${Math.round(currentTotalCost).toLocaleString()} current combined ordering+holding cost vs. €${Math.round(totalCostAtEoq).toLocaleString()} at the optimal quantity).`,
      bestSupplier
        ? `Reorder point: ${reorderPoint!.toLocaleString()} units — real daily demand (${dailyDemand.toFixed(1)} units/day) × ${bestSupplier.supplier_name}'s real ${bestSupplier.lead_time_days}-day lead time (the fastest of ${supplierRows.length} supplier(s) tracked for ${category}), inflated for that supplier's ${bestSupplier.on_time_delivery_rate}% real on-time delivery rate — a less reliable supplier gets a bigger safety-stock buffer for the same lead time. Reorder when on-hand inventory falls to this level, not just every ${Math.round(reorderIntervalDays)} days on the calendar.`
        : `No supplier is tracked for the "${category}" product category (Supplier Intelligence), so a real-lead-time reorder point can't be computed here — only the order-quantity math above, which doesn't depend on lead time.`,
    ];

    return NextResponse.json({
      inputs: { category },
      annualDemandUnits,
      avgCostPrice: Math.round(avgCost * 100) / 100,
      assumedOrderCost: S,
      holdingCostPerUnit: Math.round(H * 100) / 100,
      eoq: Math.round(eoq),
      ordersPerYear: Math.round(ordersPerYear * 10) / 10,
      reorderIntervalDays: Math.round(reorderIntervalDays),
      totalCostAtEoq: Math.round(totalCostAtEoq),
      currentTotalCost: Math.round(currentTotalCost),
      annualSavings: Math.round(annualSavings),
      reorderPoint,
      supplier: bestSupplier ? { name: bestSupplier.supplier_name, leadTimeDays: bestSupplier.lead_time_days, onTimeDeliveryRate: bestSupplier.on_time_delivery_rate } : null,
      methodology,
    });
  } catch (error) {
    console.error("BIGQUERY ERROR:", error);
    return NextResponse.json({ error: "BigQuery failed", details: String(error) }, { status: 500 });
  }
}
