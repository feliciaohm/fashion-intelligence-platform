import Link from "next/link";
import { PAGE_INFO } from "@/lib/related-pages";

export default function RelatedPages({ hrefs }: { hrefs: string[] }) {
  const items = hrefs.map((href) => ({ href, ...PAGE_INFO[href] })).filter((i) => i.name);
  if (items.length === 0) return null;

  return (
    <div className="related-pages no-print">
      <div className="stat-label">Related pages</div>
      <div className="related-pages-grid">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="related-page-card">
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: "var(--color-ink)" }}>{item.name}</div>
            <div className="text-muted" style={{ fontSize: 12, lineHeight: 1.5 }}>{item.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
