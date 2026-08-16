"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getStoredRole, setStoredRole, ROLES, ROLE_CHANGE_EVENT, RoleId } from "@/lib/roles";
import { useMobileNav } from "@/lib/mobile-nav-context";
import { createClient } from "@/lib/supabase/client";
import GlobalSearch from "@/components/GlobalSearch";
import {
  GaugeIcon,
  GridIcon,
  RouteIcon,
  GiftIcon,
  UsersIcon,
  UserIcon,
  TagIcon,
  RecycleIcon,
  StoreIcon,
  BoxesIcon,
  TruckIcon,
  MegaphoneIcon,
  DollarIcon,
  DocumentIcon,
  ChartBarIcon,
  PieIcon,
  ReturnArrowIcon,
  BuildingIcon,
  BrainIcon,
  TreeIcon,
  BridgeIcon,
  TargetIcon,
  ClipboardIcon,
  ForkIcon,
  TrendUpIcon,
  CompassIcon,
  LayersIcon,
  ShieldCheckIcon,
  GearIcon,
} from "@/components/NavIcons";

const links = [
  {
    section: "Overview",
    items: [
      { href: "/executive", label: "Executive Summary", icon: GaugeIcon },
      { href: "/dashboard", label: "Dashboard", icon: GridIcon },
      { href: "/visitor-journey", label: "Visitor Journey", icon: RouteIcon },
      { href: "/gifting-roi", label: "Gifting ROI", icon: GiftIcon },
      { href: "/roi", label: "Influencer ROI", icon: MegaphoneIcon },
    ],
  },
  {
    section: "Commerce",
    items: [
      { href: "/products", label: "Products", icon: TagIcon },
      { href: "/product-lifecycle", label: "Product Lifecycle", icon: RecycleIcon },
      { href: "/pricing", label: "Pricing Intelligence", icon: DollarIcon },
      { href: "/stores", label: "Store Performance", icon: StoreIcon },
      { href: "/wholesale", label: "Wholesale", icon: BoxesIcon },
      { href: "/suppliers", label: "Supplier Intelligence", icon: TruckIcon },
    ],
  },
  {
    section: "People",
    items: [
      { href: "/influencers", label: "Influencers", icon: MegaphoneIcon },
      { href: "/customers", label: "Customers", icon: UsersIcon },
      { href: "/customer-journey", label: "Customer Journey", icon: RouteIcon },
    ],
  },
  {
    section: "Finance",
    items: [
      { href: "/consolidated-pnl", label: "Consolidated P&L", icon: DocumentIcon },
      { href: "/finance", label: "Finance", icon: DollarIcon },
      { href: "/finance-deep", label: "Finance Deep-Dive", icon: ChartBarIcon },
      { href: "/variance-report", label: "Monthly Variance Report", icon: DocumentIcon },
      { href: "/cost-centers", label: "Cost Centers", icon: BuildingIcon },
      { href: "/cost-allocation", label: "Cost Allocation Engine", icon: PieIcon },
      { href: "/returns", label: "Returns", icon: ReturnArrowIcon },
    ],
  },
  {
    section: "Intelligence",
    items: [
      { href: "/decision-intelligence", label: "Decision Intelligence", icon: BrainIcon },
      { href: "/dashboards", label: "Dashboards", icon: GridIcon },
      { href: "/value-drivers", label: "Value Driver Tree", icon: TreeIcon },
      { href: "/growth-bridge", label: "Growth Bridge", icon: BridgeIcon },
      { href: "/benchmarks", label: "Benchmark Intelligence", icon: TargetIcon },
      { href: "/consulting-summary", label: "Consulting Summary", icon: ClipboardIcon },
      { href: "/scenario", label: "Scenario Modeling", icon: ForkIcon },
      { href: "/forecast", label: "Forecast", icon: TrendUpIcon },
      { href: "/explore", label: "Explore", icon: CompassIcon },
      { href: "/master", label: "Master Views", icon: LayersIcon },
    ],
  },
  {
    section: "Platform",
    items: [
      { href: "/data-quality", label: "Data Quality", icon: ShieldCheckIcon },
      { href: "/custom-data", label: "Custom Data", icon: DocumentIcon },
      { href: "/settings", label: "Settings", icon: GearIcon },
    ],
  },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<RoleId | null>(null);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  const { open: mobileOpen, close: closeMobileNav } = useMobileNav();

  const [email, setEmail] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

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
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
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

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    return null;
  }

  const initial = email ? email[0].toUpperCase() : "?";

  return (
    <>
      {mobileOpen && <div className="mobile-nav-backdrop" onClick={closeMobileNav} />}
      <nav className={`app-nav${mobileOpen ? " mobile-open" : ""}`}>
      {/* No product name here yet -- removed per direct feedback until a
          real name is chosen. <GlobalSearch /> is now the top of the
          sidebar instead of a wordmark. */}
      <GlobalSearch />

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

      <div className="app-nav-scroll">
        {links.map((group) => (
          <div className="app-nav-section" key={group.section}>
            <div className="app-nav-section-label">{group.section}</div>
            {group.items.map((item) => {
              const ItemIcon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`app-nav-link${active ? " active" : ""}`}
                >
                  <ItemIcon />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {email && (
        <div ref={userMenuRef} className="app-nav-user">
          <button type="button" className="app-nav-user-trigger" onClick={() => setUserMenuOpen((v) => !v)}>
            <span className="app-nav-user-avatar">{initial}</span>
            <span className="app-nav-user-email">{email}</span>
            <svg
              className={`role-switcher-chevron${userMenuOpen ? " open" : ""}`}
              width="9"
              height="9"
              viewBox="0 0 10 10"
              fill="none"
            >
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {userMenuOpen && (
            <div className="app-nav-user-overlay">
              <Link href="/settings" className="app-nav-user-overlay-row" onClick={() => setUserMenuOpen(false)}>
                Settings
              </Link>
              <button type="button" className="app-nav-user-overlay-row" onClick={signOut}>
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
      </nav>
    </>
  );
}
