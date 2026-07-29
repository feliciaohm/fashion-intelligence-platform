import Link from "next/link";
import ExportCsvButton from "./ExportCsvButton";
import EmptyState from "./EmptyState";

export default function ProductsTable({ data }: { data: any[] }) {
  if (data.length === 0) {
    return (
      <EmptyState
        label="No Results"
        message="No products found for this market — try clearing the filter or choosing a different one."
      />
    );
  }

  return (
    <div>
      <div className="data-table-toolbar">
        <ExportCsvButton data={data} filename="products.csv" />
      </div>
      <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th>Collection</th>
            <th>Price</th>
            <th>Retail Revenue</th>
            <th>Ecommerce Revenue</th>
            <th>Influencer ROI</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.product_slug}>
              <td>
                <Link href={`/products/${row.product_slug}`}>{row.product_name}</Link>
              </td>
              <td>{row.category}</td>
              <td>{row.collection}</td>
              <td>€{row.price}</td>
              <td>{row.retail_revenue ? `€${row.retail_revenue}` : "—"}</td>
              <td>{row.ecommerce_revenue ? `€${row.ecommerce_revenue}` : "—"}</td>
              <td
                style={{
                  color: row.influencer_roi == null
                    ? "var(--color-ink-muted)"
                    : row.influencer_roi >= 0
                      ? "var(--status-good)"
                      : "var(--status-critical)",
                }}
              >
                {row.influencer_roi != null ? `${row.influencer_roi}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
