import { bigquery } from "@/lib/bigquery";
import { PROJECT, DimensionKey, FilterTag, quarterToRange } from "@/lib/intelligence";

interface TargetConfig {
  label: string;
  table: string;
  dimensionColumns: Partial<Record<Exclude<DimensionKey, "time_period">, string>>;
  timeColumn?: { column: string; mode: "date" | "month_string" };
  orderBy?: string;
}

// Every module the command center can search across. Each target declares which
// of the 6 filter dimensions it actually supports -- a filter tag only applies
// to a module if that module has a matching column. This is why "Marketing"
// (department) only ever touches Cost Centers, while "Sweden" (country) can
// touch Influencer Campaigns, Customers, and Store Performance at once.
export const TARGETS: TargetConfig[] = [
  {
    label: "Influencer Campaigns",
    table: "influencer_product_performance",
    dimensionColumns: { influencer: "influencer", product: "product_slug", country: "country" },
    timeColumn: { column: "post_date", mode: "date" },
    orderBy: "total_revenue DESC",
  },
  {
    label: "Products",
    table: "product_lifecycle",
    dimensionColumns: { product: "product_slug" },
    timeColumn: { column: "launch_date", mode: "date" },
    orderBy: "revenue_direct DESC",
  },
  {
    label: "Finance by Channel",
    table: "finance_channel_monthly",
    dimensionColumns: { channel: "channel" },
    timeColumn: { column: "month", mode: "month_string" },
    orderBy: "month DESC",
  },
  {
    label: "Cost Centers",
    table: "cost_centers",
    dimensionColumns: { department: "name" },
    timeColumn: { column: "period", mode: "month_string" },
    orderBy: "period DESC",
  },
  {
    label: "Customers",
    table: "crm_customers",
    dimensionColumns: { country: "country" },
    timeColumn: { column: "first_purchase_date", mode: "date" },
    orderBy: "lifetime_value DESC",
  },
  {
    label: "Store Performance",
    table: "store_performance",
    dimensionColumns: { country: "country" },
    timeColumn: { column: "period", mode: "month_string" },
    orderBy: "revenue DESC",
  },
  {
    label: "Wholesale Orders",
    table: "wholesale_orders",
    dimensionColumns: { product: "product_slug" },
    timeColumn: { column: "order_date", mode: "date" },
    orderBy: "order_date DESC",
  },
  {
    label: "Returns",
    table: "returns",
    dimensionColumns: { product: "product_slug", influencer: "influencer_campaign" },
    timeColumn: { column: "return_date", mode: "date" },
    orderBy: "return_date DESC",
  },
];

interface BuiltQuery {
  label: string;
  sql: string;
  params: Record<string, unknown>;
  types: Record<string, unknown>;
}

// Builds a parameterized query for one target from whichever active filters it
// actually supports. Returns null if none of the active filters apply to this
// module at all -- that module is simply not part of the results.
//
// Filter combination rule: multiple values within the SAME dimension are OR'd
// (country=Sweden OR country=China -- a row can never match two countries at
// once, so AND-ing them would always return zero rows). Different dimensions
// are AND'd (country=Sweden AND channel=wholesale). Standard BI-tool
// multi-select semantics.
export function buildTargetQuery(target: TargetConfig, filters: FilterTag[]): BuiltQuery | null {
  const params: Record<string, unknown> = {};
  const types: Record<string, unknown> = {};
  const whereClauses: string[] = [];
  let i = 0;

  const byDimension = new Map<DimensionKey, string[]>();
  for (const f of filters) {
    if (!byDimension.has(f.dimension)) byDimension.set(f.dimension, []);
    byDimension.get(f.dimension)!.push(f.value);
  }

  for (const [dimension, values] of byDimension) {
    if (dimension === "time_period") {
      if (!target.timeColumn) continue;
      if (target.timeColumn.mode === "date") {
        // BigQuery DATE params must be wrapped with bigquery.date() -- a raw
        // string with types:{p:"DATE"} is accepted silently but matches zero
        // rows (confirmed live: the same BETWEEN query returns 7 rows with
        // bigquery.date() and 0 with a plain string). Don't regress this.
        const orClauses = values.map((v) => {
          const { start, end } = quarterToRange(v);
          const pStart = `p${i++}`;
          const pEnd = `p${i++}`;
          params[pStart] = bigquery.date(start);
          params[pEnd] = bigquery.date(end);
          return `${target.timeColumn!.column} BETWEEN @${pStart} AND @${pEnd}`;
        });
        whereClauses.push(`(${orClauses.join(" OR ")})`);
      } else {
        const allMonths = values.flatMap((v) => quarterToRange(v).months);
        const pName = `p${i++}`;
        whereClauses.push(`${target.timeColumn.column} IN UNNEST(@${pName})`);
        params[pName] = allMonths;
        types[pName] = ["STRING"];
      }
    } else {
      const col = target.dimensionColumns[dimension];
      if (!col) continue;
      const pName = `p${i++}`;
      whereClauses.push(`${col} IN UNNEST(@${pName})`);
      params[pName] = values;
      types[pName] = ["STRING"];
    }
  }

  if (whereClauses.length === 0) return null;

  const sql = `
    SELECT * FROM \`${PROJECT}.${target.table}\`
    WHERE ${whereClauses.join(" AND ")}
    ${target.orderBy ? `ORDER BY ${target.orderBy}` : ""}
    LIMIT 200
  `;

  return { label: target.label, sql, params, types };
}
