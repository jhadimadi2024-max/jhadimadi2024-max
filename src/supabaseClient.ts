/**
 * Supabase Client Bridge (src/supabaseClient.ts)
 * Re-exports the unified Supabase client supporting environment variables:
 * NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 */
export * from './supabase';
export { default } from './supabase';
export { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } from './supabase';

