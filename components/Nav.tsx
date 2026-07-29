"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getStoredRole, setStoredRole, ROLES, ROLE_CHANGE_EVENT, RoleId } from "@/lib/roles";
import { useMobileNav } from "@/lib/mobile-nav-context";

const links = [
  {
    section: "Overview",
    items: [
      { href: "/executive", label: "Executive Summary" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/roi", label: "Influencer ROI" },
    ],
  },
  {
    section: "Commerce",
    items: [
      { href: "/products", label: "Products" },
      { href: "/product-lifecycle", label: "Product Lifecycle" },
      { href: "/pricing", label: "Pricing Intelligence" },
      { href: "/stores", label: "Store Performance" },
      { href: "/wholesale", label: "Wholesale" },
      { href: "/suppliers", label: "Supplier Intelligence" },
    ],
  },
  {
    section: "People",
    items: [
      { href: "/influencers", label: "Influencers" },
      { href: "/customers", label: "Customers" },
      { href: "/customer-journey", label: "Customer Journey" },
    ],
  },
  {
    section: "Finance",
    items: [
      { href: "/consolidated-pnl", label: "Consolidated P&L" },
      { href: "/finance", label: "Finance" },
      { href: "/finance-deep", label: "Finance Deep-Dive" },
      { href: "/variance-report", label: "Monthly Variance Report" },
      { href: "/cost-centers", label: "Cost Centers" },
      { href: "/cost-allocation", label: "Cost Allocation Engine" },
      { href: "/returns", label: "Returns" },
    ],
  },
  {
    section: "Intelligence",
    items: [
      { href: "/decision-intelligence", label: "Decision Intelligence" },
      { href: "/value-drivers", label: "Value Driver Tree" },
      { href: "/growth-bridge", label: "Growth Bridge" },
      { href: "/benchmarks", label: "Benchmark Intelligence" },
      { href: "/consulting-summary", label: "Consulting Summary" },
      { href: "/scenario", label: "Scenario Modeling" },
      { href: "/forecast", label: "Forecast" },
      { href: "/explore", label: "Explore" },
      { href: "/master", label: "Master Views" },
    ],
  },
  {
    section: "Platform",
    items: [{ href: "/settings", label: "Settings" }],
  },
];

export default function Nav() {
  const pathname = usePathname();
  const [role, setRole] = useState<RoleId | null>(null);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  const { open: mobileOpen, close: closeMobileNav } = useMobileNav();

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      getStoredRole().then((r) => {
        if (!cancelled) setRole(r);
      });
    };
    sync();
    window.addEventListener(ROLE_CHANGE_EVENT, sync);
    return () => {
      cancelled = true;
      window.removeEventListener(ROLE_CHANGE_EVENT, sync);
    };
  }, [pathname]);

  // Close the mobile drawer whenever the route changes -- otherwise tapping
  // a link on mobile would navigate underneath a sidebar still covering the
  // screen.
  useEffect(() => {
    closeMobileNav();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setRoleMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const roleLabel = ROLES.find((r) => r.id === role)?.label;

  function selectRole(id: RoleId) {
    // Optimistic: update the label instantly (smooth for live demos), the
    // Supabase write + ROLE_CHANGE_EVENT broadcast happen in the background.
    setRole(id);
    setRoleMenuOpen(false);
    setStoredRole(id);
  }

  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    return null;
  }

  return (
    <>
      {mobileOpen && <div className="mobile-nav-backdrop" onClick={closeMobileNav} />}
      <nav className={`app-nav${mobileOpen ? " mobile-open" : ""}`}>
      <Link href="/" className="app-nav-brand" style={{ display: "block" }}>
        Fashion Intelligence
        <span>Platform</span>
      </Link>

      {roleLabel && (
        <div ref={roleMenuRef} className="role-switcher">
          <button
            type="button"
            className="role-switcher-trigger"
            onClick={() => setRoleMenuOpen((v) => !v)}
          >
            <span className="role-switcher-eyebrow">Viewing as</span>
            <span className="role-switcher-label">
              {roleLabel}
              <svg
                className={`role-switcher-chevron${roleMenuOpen ? " open" : ""}`}
                width="9"
                height="9"
                viewBox="0 0 10 10"
                fill="none"
              >
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>

          {roleMenuOpen && (
            <div className="role-switcher-overlay">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`role-switcher-row${r.id === role ? " active" : ""}`}
                  onClick={() => selectRole(r.id)}
                >
                  <span className="role-switcher-row-label">{r.label}</span>
                  <span className="role-switcher-row-tagline">{r.tagline}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <Link
        href="/intelligence"
        className={`app-nav-command${pathname === "/intelligence" ? " active" : ""}`}
      >
        Intelligence
        <span>Command Center</span>
      </Link>

      {links.map((group) => (
        <div className="app-nav-section" key={group.section}>
          <div className="app-nav-section-label">{group.section}</div>
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`app-nav-link${pathname === item.href ? " active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ))}
      </nav>
    </>
  );
}
