// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasepublishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabasepublishableKey) {
  throw new Error('Supabase URL and publishable key must be provided');
}

export const supabase = createClient(supabaseUrl, supabasepublishableKey);
