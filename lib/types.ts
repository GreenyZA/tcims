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
  created_at?: string;
};
