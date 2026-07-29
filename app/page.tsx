"use client";

import { useEffect, useState } from "react";
import RoleSelector from "@/components/RoleSelector";
import RoleHome from "@/components/RoleHome";
import { getStoredRole, setStoredRole, ROLES, ROLE_CHANGE_EVENT, RoleId } from "@/lib/roles";

export default function LandingPage() {
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

  function selectRole(id: RoleId) {
    setRole(id);
    setStoredRole(id);
  }

  function switchRole() {
    setRole(null);
    setStoredRole(null);
  }

  // Undetermined yet (first paint, before the Supabase read completes) --
  // render nothing rather than flashing the role picker and then swapping to
  // the saved role a moment later.
  if (role === undefined) {
    return null;
  }

  if (role === null) {
    return <RoleSelector onSelect={selectRole} />;
  }

  const config = ROLES.find((r) => r.id === role)!;
  return <RoleHome role={config} journey={journey} onSwitchRole={switchRole} />;
}
