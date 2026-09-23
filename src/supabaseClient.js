import { createClient } from '@supabase/supabase-js';

export const NEXT_PUBLIC_SUPABASE_URL = "https://dwhsqftllkximhfvwqak.supabase.co";
export const NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3aHNxZnRsbGt4aW1oZnZ3cWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3MzAyNzEsImV4cCI6MjEwNTMwNjI3MX0.GbceleQmKhRfSzE-c_Bq3fh-YA7I4oZI1fGCsU-SaPI";

export const supabaseUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL)) ||
  (typeof process !== 'undefined' && process.env && (process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)) ||
  NEXT_PUBLIC_SUPABASE_URL;

export const supabaseAnonKey = 
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) ||
  (typeof process !== 'undefined' && process.env && (process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)) ||
  NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  },
});

export default supabase;
