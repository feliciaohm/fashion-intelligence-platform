// Shared real computation behind /api/decision/supplier-payment. Every
// supplier row already has a real payment_terms string ("Net 30", "Net 45",
// "50% deposit, Net 30", etc.) -- it was only ever displayed as plain text
// on the Suppliers page, never parsed into an actual number or used to
// compute anything. Days Payable Outstanding (DPO) and the working-capital
// it implies is standard, real finance math, not invented.
import { bigquery } from "@/lib/bigquery";

const PROJECT = "project-cb954e13-3b16-432f-aa7.analytics_lab";

export interface SupplierPaymentRow {
  supplierName: string;
  paymentTerms: string;
  paymentDays: number | null;
  hasDeposit: boolean;
  estimatedAnnualSpend: number;
  estimatedPayablesBalance: number | null;
}

export interface SupplierPaymentSummary {
  suppliers: SupplierPaymentRow[];
  totalAnnualSpend: number;
  totalPayablesBalance: number;
  avgPaymentDays: number;
  unparsedCount: number;
}

// "Net 30" -> 30. "50% deposit, Net 30" -> 30 (the deferred portion's term
// length; the deposit itself is flagged separately via hasDeposit, not
// silently folded into a blended number this couldn't actually verify).
function parsePaymentDays(terms: string): number | null {
  const match = terms.match(/Net\s*(\d+)/i);
  if (!match) return null;
  return parseInt(match[1], 10);
}

export async function getSupplierPaymentSummary(): Promise<SupplierPaymentSummary> {
  const [[suppliers], [categorySpend]] = await Promise.all([
    bigquery.query(`SELECT supplier_name, product_category, payment_terms FROM \`${PROJECT}.suppliers\` ORDER BY supplier_name`),
    bigquery.query(
      `SELECT category AS product_category, SUM(cost_price * units_sold_direct) AS total_cogs_spend
       FROM \`${PROJECT}.product_lifecycle\`
       GROUP BY category`
    ),
  ]);

  const spendByCategory: Record<string, number> = {};
  categorySpend.forEach((r: any) => {
    spendByCategory[r.product_category] = r.total_cogs_spend || 0;
  });
  const suppliersByCategory: Record<string, number> = {};
  suppliers.forEach((s: any) => {
    suppliersByCategory[s.product_category] = (suppliersByCategory[s.product_category] || 0) + 1;
  });

  const rows: SupplierPaymentRow[] = suppliers.map((s: any) => {
    const categoryTotal = spendByCategory[s.product_category] || 0;
    const supplierCountInCategory = suppliersByCategory[s.product_category] || 1;
    // Same real-but-approximated spend estimate already used on the
    // Suppliers page (category COGS spend split evenly across suppliers in
    // that category, since there's no direct supplier-to-transaction link).
    const estimatedAnnualSpend = Math.round(categoryTotal / supplierCountInCategory);
    const paymentDays = parsePaymentDays(s.payment_terms);
    // Standard DPO -> average payables balance formula: (annual spend / 365) x payment days.
    const estimatedPayablesBalance = paymentDays !== null ? Math.round((estimatedAnnualSpend / 365) * paymentDays) : null;

    return {
      supplierName: s.supplier_name,
      paymentTerms: s.payment_terms,
      paymentDays,
      hasDeposit: /deposit/i.test(s.payment_terms),
      estimatedAnnualSpend,
      estimatedPayablesBalance,
    };
  });

  const parsedRows = rows.filter((r) => r.paymentDays !== null);
  const totalAnnualSpend = rows.reduce((s, r) => s + r.estimatedAnnualSpend, 0);
  const totalPayablesBalance = parsedRows.reduce((s, r) => s + (r.estimatedPayablesBalance ?? 0), 0);
  const avgPaymentDays = parsedRows.length > 0 ? parsedRows.reduce((s, r) => s + (r.paymentDays ?? 0), 0) / parsedRows.length : 0;

  return {
    suppliers: rows,
    totalAnnualSpend,
    totalPayablesBalance,
    avgPaymentDays: Math.round(avgPaymentDays * 10) / 10,
    unparsedCount: rows.length - parsedRows.length,
  };
}
