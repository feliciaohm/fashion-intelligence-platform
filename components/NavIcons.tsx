// Small line icons for the sidebar nav items -- hand-drawn to match the
// Kravio reference's icon+label row style, consistent with the rest of
// the codebase's inline-SVG icons (no icon library dependency). A modest,
// reused set rather than 29 perfectly bespoke icons -- shapes are shared
// across conceptually similar pages, the same way most real product
// sidebars do it.
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function GaugeIcon() {
  return <Icon><path d="M4 14a6 6 0 1112 0" /><path d="M10 14l3-3.5" /><circle cx="10" cy="14" r="1" /></Icon>;
}
export function GridIcon() {
  return <Icon><rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1" /><rect x="11" y="3.5" width="5.5" height="5.5" rx="1" /><rect x="3.5" y="11" width="5.5" height="5.5" rx="1" /><rect x="11" y="11" width="5.5" height="5.5" rx="1" /></Icon>;
}
export function RouteIcon() {
  return <Icon><circle cx="4.5" cy="15.5" r="2" /><circle cx="15.5" cy="4.5" r="2" /><path d="M6.2 14.3C9.5 13 8.7 6.8 13.8 5.7" strokeDasharray="1.5 2.6" /></Icon>;
}
export function GiftIcon() {
  return <Icon><rect x="3" y="8.5" width="14" height="8.5" rx="1.2" /><path d="M3 8.5h14M10 8.5v8.5" /><path d="M10 8.5c0-2.2-1.7-4-3.4-4C5.1 4.5 5.1 6.5 6.6 7.4c1 .6 2.2.9 3.4 1.1zM10 8.5c0-2.2 1.7-4 3.4-4 1.5 0 1.5 2-.1 2.9-1 .6-2.2.9-3.3 1.1z" /></Icon>;
}
export function UsersIcon() {
  return <Icon><circle cx="7" cy="7" r="2.6" /><path d="M2.5 16c.5-3 2.2-4.5 4.5-4.5s4 1.5 4.5 4.5" /><circle cx="14.5" cy="7.5" r="2.1" /><path d="M12.5 11.5c1.8.2 3.2 1.6 3.6 4" /></Icon>;
}
export function UserIcon() {
  return <Icon><circle cx="10" cy="6.5" r="3" /><path d="M4 16.5c.7-3.8 2.9-5.7 6-5.7s5.3 1.9 6 5.7" /></Icon>;
}
export function TagIcon() {
  return <Icon><path d="M10.5 3.5h4.5a1.5 1.5 0 011.5 1.5v4.5L8 17 3 12l8-8.5z" /><circle cx="13" cy="7" r="1" /></Icon>;
}
export function RecycleIcon() {
  return <Icon><path d="M9 3.5l2.3 4-2 1.1" /><path d="M4.5 9.5c-1 1.7-1 3.3.5 5.5h3" /><path d="M14 16.5c1.9 0 3-1 4-3l-1.8-1.1" /><path d="M11.5 16.5H8" /></Icon>;
}
export function StoreIcon() {
  return <Icon><path d="M3 8l1-4.5h12L17 8" /><path d="M3 8v8h14V8" /><path d="M3 8a2 2 0 004 0 2 2 0 004 0 2 2 0 004 0 2 2 0 004 0" /></Icon>;
}
export function BoxesIcon() {
  return <Icon><rect x="3" y="10" width="6" height="6" rx="0.8" /><rect x="11" y="10" width="6" height="6" rx="0.8" /><rect x="7" y="3.5" width="6" height="6" rx="0.8" /></Icon>;
}
export function TruckIcon() {
  return <Icon><rect x="2.5" y="6.5" width="9" height="7" rx="0.8" /><path d="M11.5 9h3l2.5 2.5v2h-5.5z" /><circle cx="6" cy="15" r="1.4" /><circle cx="14" cy="15" r="1.4" /></Icon>;
}
export function MegaphoneIcon() {
  return <Icon><path d="M3 8.5v3l9 3V5.5l-9 3z" /><path d="M12 5.5a4 4 0 010 6.5" /><path d="M5.5 11.5L6 16h2l-.5-4.2" /></Icon>;
}
export function DollarIcon() {
  return <Icon><circle cx="10" cy="10" r="6.7" /><path d="M10 6.3v7.4M12 8.2c0-1-.9-1.7-2-1.7s-2 .6-2 1.6c0 2.2 4 1.1 4 3.3 0 1-.9 1.7-2 1.7s-2-.7-2-1.7" /></Icon>;
}
export function DocumentIcon() {
  return <Icon><path d="M6 3h5.5L15 6.5V17H6z" /><path d="M11.5 3v3.5H15" /><path d="M8 10.5h4M8 13h4" /></Icon>;
}
export function ChartBarIcon() {
  return <Icon><path d="M4 16.5v-6M9 16.5v-9M14 16.5v-4" /><path d="M2.5 16.5h15" /></Icon>;
}
export function PieIcon() {
  return <Icon><path d="M10 3.5v6.5h6.5A6.5 6.5 0 1010 3.5z" /></Icon>;
}
export function ReturnArrowIcon() {
  return <Icon><path d="M5 8h8a3.5 3.5 0 010 7h-3" /><path d="M8 12l-3-4 3-4" /></Icon>;
}
export function BuildingIcon() {
  return <Icon><rect x="4.5" y="3" width="8" height="14" rx="0.8" /><path d="M7 6.5h.01M10 6.5h.01M7 9.5h.01M10 9.5h.01M7 12.5h.01M10 12.5h.01" /><path d="M12.5 8h3v9h-3" /></Icon>;
}
export function BrainIcon() {
  return <Icon><path d="M8 4.5a2.3 2.3 0 00-2.3 2.3v.4A2.3 2.3 0 004 9.3a2.3 2.3 0 001.3 4.1 2.3 2.3 0 002.7 2.6c.4.3.9.5 1.5.5V4.5z" /><path d="M12 4.5a2.3 2.3 0 012.3 2.3v.4A2.3 2.3 0 0116 9.3a2.3 2.3 0 01-1.3 4.1 2.3 2.3 0 01-2.7 2.6c-.4.3-.9.5-1.5.5V4.5z" /></Icon>;
}
export function TreeIcon() {
  return <Icon><circle cx="10" cy="4.5" r="1.6" /><circle cx="5" cy="15" r="1.6" /><circle cx="15" cy="15" r="1.6" /><path d="M10 6v4M10 10L5 13.4M10 10l5 3.4" /></Icon>;
}
export function BridgeIcon() {
  return <Icon><path d="M3 13c1.5-4 12.5-4 14 0" /><path d="M4 13v3M8 13v3M12 13v3M16 13v3" /></Icon>;
}
export function TargetIcon() {
  return <Icon><circle cx="10" cy="10" r="6.5" /><circle cx="10" cy="10" r="3.3" /><circle cx="10" cy="10" r="0.6" fill="currentColor" /></Icon>;
}
export function ClipboardIcon() {
  return <Icon><rect x="5" y="4" width="10" height="13" rx="1" /><rect x="7.5" y="2.5" width="5" height="3" rx="0.8" /><path d="M7.5 9h5M7.5 12h5" /></Icon>;
}
export function ForkIcon() {
  return <Icon><circle cx="5" cy="4.5" r="1.6" /><circle cx="5" cy="15.5" r="1.6" /><circle cx="15" cy="10" r="1.6" /><path d="M5 6v4c0 2 0 2 3.5 2H12" /><path d="M12 12l1.5-1M12 12v-4c0-2 0-2 1.5-2" /></Icon>;
}
export function TrendUpIcon() {
  return <Icon><path d="M3 14l5-5 3 3 6-6.5" /><path d="M13.5 5.5H17V9" /></Icon>;
}
export function CompassIcon() {
  return <Icon><circle cx="10" cy="10" r="6.7" /><path d="M12.5 7.5l-1.8 4-4 1.8 1.8-4z" /></Icon>;
}
export function LayersIcon() {
  return <Icon><path d="M10 3.5l6.5 3.5L10 10.5 3.5 7z" /><path d="M3.5 10.5L10 14l6.5-3.5" /><path d="M3.5 14L10 17.5 16.5 14" /></Icon>;
}
export function ShieldCheckIcon() {
  return <Icon><path d="M10 3l6 2.2v4.6c0 4-2.6 6.4-6 7.2-3.4-.8-6-3.2-6-7.2V5.2z" /><path d="M7.3 10l1.8 1.8 3.6-3.8" /></Icon>;
}
export function GearIcon() {
  return <Icon><circle cx="10" cy="10" r="2.6" /><path d="M10 3.5v2M10 14.5v2M16.5 10h-2M5.5 10h-2M14.9 5.1l-1.4 1.4M6.5 13.5l-1.4 1.4M14.9 14.9l-1.4-1.4M6.5 6.5L5.1 5.1" /></Icon>;
}
export function LinkIcon() {
  return <Icon><path d="M7.3 12.7l5.4-5.4" /><path d="M6 13.9a3 3 0 010-4.2l1.7-1.7a3 3 0 014.2 0" /><path d="M14 6.1a3 3 0 010 4.2l-1.7 1.7a3 3 0 01-4.2 0" /></Icon>;
}
