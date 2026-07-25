// lib/types.ts
import { Database } from './supabase.types';

export type IncidentsTable = Database['public']['Tables']['incidents'];
export type IncidentsTableRow = IncidentsTable['Row'];