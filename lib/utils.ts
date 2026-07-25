// lib/utils.ts
import { supabase } from './supabase';

export async function getIncidents() {
  const { data, error } = await supabase.from('incidents').select('*');
  if (error) throw error;
  return data as IncidentsTableRow[];
}

export async function createIncident(incident: Partial<IncidentsTableRow>) {
  const { data, error } = await supabase.from('incidents').insert([incident]);
  if (error) throw error;
  return data[0] as IncidentsTableRow;
}