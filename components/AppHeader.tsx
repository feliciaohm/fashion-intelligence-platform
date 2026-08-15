"use client";

import { usePathname } from "next/navigation";
import { useMobileNav } from "@/lib/mobile-nav-context";

// Search moved into the sidebar (matching the Kravio reference's layout --
// search lives at the top of the nav, not a separate top bar). This header
// now only exists for the mobile hamburger toggle; on desktop it renders
// nothing and takes up no space (see .app-header's base display:none).
export default function AppHeader() {
  const pathname = usePathname();
  const { toggle } = useMobileNav();

  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    return null;
  }

  return (
    <div className="app-header no-print">
      <button type="button" className="mobile-menu-button" onClick={toggle} aria-label="Toggle navigation">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <line x1="2" y1="4.5" x2="16" y2="4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="2" y1="13.5" x2="16" y2="13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
