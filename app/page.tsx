"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RoleHome from "@/components/RoleHome";
import { getStoredRole, ROLES, ROLE_CHANGE_EVENT, RoleId } from "@/lib/roles";

export default function LandingPage() {
  const router = useRouter();
  // proxy.ts guarantees a role is set in the profile before this page is ever
  // reached -- undefined here is only ever the brief instant before the
  // first Supabase read resolves, never "no role" (that's /onboarding's job).
  const [role, setRole] = useState<RoleId | null | undefined>(undefined);
  const [journey, setJourney] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      getStoredRole().then((r) => {
        if (!cancelled) setRole(r);
      });
    };
    sync();
    fetch("/api/influencer-journey")
      .then((res) => (res.ok ? res.json() : []))
      .then(setJourney)
      .catch(() => setJourney([]));

    // The Nav's role switcher also updates the stored role -- when that
    // happens while already on "/", there's no navigation to re-trigger this
    // effect, so this component would never otherwise learn the role
    // changed. Listen for the same event Nav dispatches.
    window.addEventListener(ROLE_CHANGE_EVENT, sync);
    return () => {
      cancelled = true;
      window.removeEventListener(ROLE_CHANGE_EVENT, sync);
    };
  }, []);

  // Defensive only -- e.g. a role cleared directly in the database. Send the
  // user back through the real onboarding flow rather than rendering a
  // broken home page.
  useEffect(() => {
    if (role === null) router.push("/onboarding");
  }, [role, router]);

  if (role === undefined || role === null) {
    return null;
  }

  const config = ROLES.find((r) => r.id === role)!;
  return <RoleHome role={config} journey={journey} />;
}
