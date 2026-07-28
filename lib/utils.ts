// lib/utils.ts
import { supabase } from './supabase';
import type { Incident, IncidentComment } from './types';

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

// ---- Pin interactions: photos, POI, comments, reports ----

// Upload a photo for an incident to the public Storage bucket and return its
// public URL. Path: incident-photos/incidents/{incidentId}/{timestamp}-{rand}.{ext}
export async function uploadIncidentPhoto(
  incidentId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext : 'jpg';
  const path = `incidents/${incidentId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${safeExt}`;
  const { error } = await supabase.storage
    .from('incident-photos')
    .upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' });
  if (error) throw error;
  const { data } = supabase.storage.from('incident-photos').getPublicUrl(path);
  return data.publicUrl;
}

// Append a photo URL to the incident's photos[] array.
export async function addIncidentPhoto(
  incidentId: string,
  url: string,
): Promise<void> {
  // Append on the DB side so we don't clobber other concurrent uploads.
  const { error } = await supabase.rpc('append_incident_photo', {
    p_incident_id: incidentId,
    p_url: url,
  });
  if (error) {
    // Fall back to a read-modify-write if the helper is missing.
    const { data, error: re } = await supabase
      .from('incidents')
      .select('photos')
      .eq('id', incidentId)
      .single();
    if (re) throw re;
    const photos = ((data as { photos?: string[] } | null)?.photos ?? []).concat(
      url,
    );
    const { error: ue } = await supabase
      .from('incidents')
      .update({ photos })
      .eq('id', incidentId);
    if (ue) throw ue;
  }
}

// Toggle the point-of-interest flag on an incident.
export async function setIncidentPoi(
  incidentId: string,
  is_poi: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('incidents')
    .update({ is_poi })
    .eq('id', incidentId);
  if (error) throw error;
}

// Add a comment to an incident.
export async function addIncidentComment(
  incidentId: string,
  body: string,
): Promise<IncidentComment> {
  const { data, error } = await supabase
    .from('incident_comments')
    .insert([{ incident_id: incidentId, body }])
    .select()
    .single();
  if (error) throw error;
  return data as unknown as IncidentComment;
}

// Fetch comments for an incident, oldest first.
export async function getIncidentComments(
  incidentId: string,
): Promise<IncidentComment[]> {
  const { data, error } = await supabase
    .from('incident_comments')
    .select('*')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as unknown[]) as IncidentComment[];
}

// File a removal report for an incident. The pin stays visible; an admin
// reviews the report later (status starts 'open').
export async function reportIncidentRemoval(
  incidentId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase
    .from('incident_reports')
    .insert([{ incident_id: incidentId, reason }]);
  if (error) throw error;
}
