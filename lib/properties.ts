// lib/properties.ts
// Land-owner property claims. Uses the BROWSER supabase client so the
// caller's auth session is attached (RLS ensures only the owner can write
// their own plots).
import { createClient } from './supabase/client';

export type Property = {
  id: string;
  owner_user_id: string;
  name: string;
  // GeoJSON Polygon (lng/lat order, WGS84) as returned by PostgREST for a
  // geometry(Polygon,4326) column.
  geometry: GeoJSON.Polygon;
  created_at: string;
};

// Insert a claimed plot. `geometry` is a GeoJSON Polygon; PostgREST maps it
// straight onto the geometry(Polygon,4326) column — no manual ST_ call needed.
export async function createProperty(input: {
  name: string;
  geometry: GeoJSON.Polygon;
}): Promise<Property> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('properties')
    .insert([{ name: input.name, geometry: input.geometry }])
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Property;
}

// Fetch the current user's claimed plots (RLS scopes to owner_user_id).
export async function getMyProperties(): Promise<Property[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as Property[];
}
