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
  // Use getSession() (cached, no network) rather than getUser() (network-
  // validated). The browser client's getUser() can return null even when a
  // valid session cookie exists, because it makes a round-trip to the Auth
  // server. RLS on the DB still enforces ownership via the JWT, so reading
  // the cached session here is safe for setting owner_user_id.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) {
    throw new Error('Not signed in — please sign out and sign in again.');
  }

  const { data, error } = await supabase
    .from('properties')
    .insert([
      { name: input.name, geometry: input.geometry, owner_user_id: user.id },
    ])
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
