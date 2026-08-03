// lib/utils.ts
import { supabase } from './supabase';
import type { Incident, IncidentComment, IncidentReport } from './types';

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

// Toggle the point-of-interest flag on an incident. Uses a SECURITY DEFINER
// RPC so it works for anonymous pins too (their user_id is NULL, so the
// normal UPDATE RLS policy would reject the change).
export async function setIncidentPoi(
  incidentId: string,
  is_poi: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('set_incident_poi', {
    p_id: incidentId,
    p_is_poi: is_poi,
  });
  if (error) throw error;
}

// Fetch ALL comments across all incidents (publicly readable). Used to mark
// which pins "have a message" on the map. Returns a map of incidentId -> latest body.
export async function getAllIncidentComments(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('incident_comments')
    .select('incident_id, body, created_at');
  if (error) throw error;
  const latest: Record<string, { body: string; created_at?: string }> = {};
  for (const row of data as Array<{
    incident_id: string;
    body: string;
    created_at?: string;
  }>) {
    const prev = latest[row.incident_id];
    if (!prev || (row.created_at ?? '') > (prev.created_at ?? '')) {
      latest[row.incident_id] = { body: row.body, created_at: row.created_at };
    }
  }
  const out: Record<string, string> = {};
  for (const [id, v] of Object.entries(latest)) out[id] = v.body;
  return out;
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

// ---- Registration gate helpers ----

// Fetch the current signup_mode ('open' or 'admin_only').
// Returns 'open' as a safe default if the config row is missing or the
// client can't reach the DB.
export async function getSignupMode(): Promise<'open' | 'admin_only'> {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'signup_mode')
    .single();

  if (error || !data) return 'open';
  return (data.value as 'open' | 'admin_only') ?? 'open';
}

// Set the signup mode (admin only).
export async function setSignupMode(
  mode: 'open' | 'admin_only',
): Promise<void> {
  const { error } = await supabase
    .from('app_config')
    .update({ value: mode })
    .eq('key', 'signup_mode');
  if (error) throw error;
}

// ---- Admin moderation helpers ----

// Fetch all incident reports (admin only). Joins incident + reporter profile.
export async function getIncidentReports(): Promise<IncidentReport[]> {
  const { data, error } = await supabase
    .from('incident_reports')
    .select(`
      id,
      incident_id,
      reason,
      status,
      created_at,
      reporter:profiles!reporter_id ( username, display_name )
    `);
  if (error) throw error;
  return (data as unknown[]) as IncidentReport[];
}

// Update a report's status (admin only).
export async function updateReportStatus(
  reportId: string,
  status: 'open' | 'reviewed' | 'actioned' | 'dismissed',
): Promise<void> {
  const { error } = await supabase
    .from('incident_reports')
    .update({ status })
    .eq('id', reportId);
  if (error) throw error;
}

// Delete an incident (admin only — the admin RLS policy allows this).
export async function deleteIncident(incidentId: string): Promise<void> {
  const { error } = await supabase
    .from('incidents')
    .delete()
    .eq('id', incidentId);
  if (error) throw error;
}

// Check whether the current user is an admin.
export async function isAdmin(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (error) return false;
  return Boolean(data?.is_admin);
}
