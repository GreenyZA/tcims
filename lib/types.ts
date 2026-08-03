// Shared domain types for TCIMS.
// NOTE: Once the Supabase schema + `supabase.types.ts` are generated (strategy Day 6-8),
// this should be reconciled with the generated `Database['public']['Tables']['incidents']` row type.

export type IncidentStatus = 'open' | 'in_progress' | 'resolved' | 'rejected';

export type Incident = {
  id: number | string;
  type: string;
  title?: string;
  description?: string;
  location: { lat: number; lng: number };
  photos?: string[];
  user_id?: string;
  anonymous?: boolean;
  status?: IncidentStatus;
  // True when the incident falls inside a claimed property polygon
  // (computed server-side by the incidents_priority_trigger).
  is_priority?: boolean;
  // The containing property, if priority.
  property_id?: string | null;
  // Point-of-interest flag (right-click -> Mark as POI).
  is_poi?: boolean;
  // Reported-for-removal flag (set by the incident_reports trigger).
  is_reported?: boolean;
  // Most recent message/comment body for this pin (enriched client-side,
  // not stored on the row — used to show a "has message" flag on the map).
  lastMessage?: string | null;
  created_at?: string;
};

export type IncidentComment = {
  id: string;
  incident_id: string;
  user_id?: string | null;
  body: string;
  created_at?: string;
};

export type IncidentReport = {
  id: string;
  incident_id: string;
  reporter_id?: string | null;
  reason: string;
  status?: 'open' | 'reviewed' | 'actioned' | 'dismissed';
  created_at?: string;
  reporter?: {
    username?: string | null;
    display_name?: string | null;
  } | null;
};
