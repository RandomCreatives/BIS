// Server-side Supabase client for Server Components and Server Actions.
// Reads/writes the auth session through Next.js cookies (Next 16: async).

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAnonKey, supabaseUrl } from '@/lib/env';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — cookie writes are only possible in
          // Server Actions / proxy. Safe to ignore because src/proxy.ts keeps
          // the session fresh on every request.
        }
      },
    },
  });
}
