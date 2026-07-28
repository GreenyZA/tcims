// lib/utils.ts
import { supabase } from './supabase';
import type { Incident } from './types';

// PostgREST stores a PostGIS geometry(Point,4326) as GeoJSON:
//   { type: "Point", coordinates: [lng, lat] }   (NOTE: longitude FIRST)
// The app works with { lat, lng }, so we convert at the boundary.
export function toGeoPoint(loc: { lat: number; lng: number }) {
  return {
    type: 'Point' as const,
    coordinates: [loc.lng, loc.lat],
  };
}

// Convert a GeoJSON Point back to { lat, lng } for the UI/map.
export function fromGeoPoint(geo: unknown): { lat: number; lng: number } | null {
  if (
    geo &&
    typeof geo === 'object' &&
    'coordinates' in geo &&
    Array.isArray((geo as { coordinates: unknown }).coordinates)
  ) {
    const [lng, lat] = (geo as { coordinates: [number, number] }).coordinates;
    return { lat, lng };
  }
  return null;
}

export async function getIncidents(): Promise<Incident[]> {
  const { data, error } = await supabase.from('incidents').select('*');
  if (error) throw error;
  return (data as unknown[]).map((row) => {
    const r = row as Record<string, unknown>;
    const loc = fromGeoPoint(r.location);
    return {
      ...r,
      // Expose a friendly {lat,lng} while keeping the raw geometry too.
      location: loc ?? { lat: 0, lng: 0 },
    } as Incident;
  });
}

export async function createIncident(
  incident: Partial<Incident>
): Promise<Incident> {
  // Convert the app-side {lat,lng} location into the GeoJSON the DB expects.
  const payload: Record<string, unknown> = { ...incident };
  if (incident.location) {
    payload.location = toGeoPoint(incident.location);
  }
  const { data, error } = await supabase
    .from('incidents')
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  if (!data) {
    throw new Error('No data returned from insert');
  }
  const loc = fromGeoPoint((data as Record<string, unknown>).location);
  return {
    ...(data as Record<string, unknown>),
    location: loc ?? { lat: 0, lng: 0 },
  } as Incident;
}
