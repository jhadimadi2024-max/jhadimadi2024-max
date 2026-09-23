import { createClient } from '@supabase/supabase-js';
import { clearBrowserResidualStorage } from './utils/clearBrowserResiduals';

// Master Credentials - Synced from jhadimadi2024-max/jhadimadi-v2
export const NEXT_PUBLIC_SUPABASE_URL = 'https://dwhsqftllkximhfvwqak.supabase.co';
export const NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3aHNxZnRsbGt4aW1oZnZ3cWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3MzAyNzEsImV4cCI6MjEwNTMwNjI3MX0.GbceleQmKhRfSzE-c_Bq3fh-YA7I4oZI1fGCsU-SaPI';

export const MASTER_SUPABASE_URL = NEXT_PUBLIC_SUPABASE_URL;
export const MASTER_SUPABASE_ANON_KEY = NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const FALLBACK_SUPABASE_URL = MASTER_SUPABASE_URL;
export const FALLBACK_SUPABASE_ANON_KEY = MASTER_SUPABASE_ANON_KEY;

// Programmatically purge residual storage before initializing the client
if (typeof window !== 'undefined') {
  try {
    clearBrowserResidualStorage();
  } catch (_) {}
}

const getEnvVar = (viteKey: string, fallbackKey?: string, nextKey?: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (nextKey && (import.meta.env as any)[nextKey]) return String((import.meta.env as any)[nextKey]).trim();
      if (import.meta.env[viteKey]) return String(import.meta.env[viteKey]).trim();
      if (fallbackKey && import.meta.env[fallbackKey]) return String(import.meta.env[fallbackKey]).trim();
    }
  } catch (_) {}
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (nextKey && process.env[nextKey]) return String(process.env[nextKey]).trim();
      if (process.env[viteKey]) return String(process.env[viteKey]).trim();
      if (fallbackKey && process.env[fallbackKey]) return String(process.env[fallbackKey]).trim();
    }
  } catch (_) {}
  return '';
};

export const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL') || MASTER_SUPABASE_URL;
export const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY') || MASTER_SUPABASE_ANON_KEY;

export const supabaseKey = supabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  },
  auth: {
    persistSession: true,
  },
});

console.log("Supabase Client Initialized:", supabaseUrl);

export const isSupabaseConfigured = true;

export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  configured: boolean;
  url: string;
  hasPublishableKey: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase.auth.getSession();
    if (error) {
      return {
        connected: false,
        configured: true,
        url: supabaseUrl,
        hasPublishableKey: true,
        error: error.message,
      };
    }
    return {
      connected: true,
      configured: true,
      url: supabaseUrl,
      hasPublishableKey: true,
    };
  } catch (err: any) {
    return {
      connected: false,
      configured: true,
      url: supabaseUrl,
      hasPublishableKey: true,
      error: err?.message || 'Network error connecting to Supabase',
    };
  }
}

export default supabase;
