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
  status?: IncidentStatus;
  created_at?: string;
};
