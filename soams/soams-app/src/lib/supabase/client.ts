'use client';

// Browser-side Supabase client (for client components: attendance grid,
// evaluation entry forms, etc. as they're built out).

import { createBrowserClient } from '@supabase/ssr';
import { supabaseAnonKey, supabaseUrl } from '@/lib/env';

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
