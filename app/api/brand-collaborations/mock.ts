export interface BrandCollaboration {
  collaboration_id: string;
  partner_brand: string;
  collection: string;
  launch_date: string;
  end_date: string;
  budget: number;
  total_revenue: number;
}

export const mockBrandCollaborations: BrandCollaboration[] = [
  {
    collaboration_id: "collab-001",
    partner_brand: "Studio Nordic",
    collection: "SS26",
    launch_date: "2026-02-01",
    end_date: "2026-04-30",
    budget: 50000,
    total_revenue: 182000,
  },
  {
    collaboration_id: "collab-002",
    partner_brand: "Atelier Lune",
    collection: "FW26",
    launch_date: "2026-09-01",
    end_date: "2026-11-30",
    budget: 65000,
    total_revenue: 0,
  },
];
