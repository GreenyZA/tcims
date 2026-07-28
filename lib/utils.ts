// lib/utils.ts
import { supabase } from './supabase';
import type { Incident } from './types';

export async function getIncidents(): Promise<Incident[]> {
  const { data, error } = await supabase.from('incidents').select('*');
  if (error) throw error;
  return data as Incident[];
}

export async function createIncident(
  incident: Partial<Incident>
): Promise<Incident> {
  const { data, error } = await supabase
    .from('incidents')
    .insert([incident])
    .select()
    .single();
  if (error) throw error;
  if (!data) {
    throw new Error('No data returned from insert');
  }
  return data as Incident;
}
