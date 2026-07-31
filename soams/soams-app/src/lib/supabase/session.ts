// Session-refresh helper used by src/proxy.ts (Next 16's middleware layer).
//
// SECURITY NOTE: this proxy performs OPTIMISTIC redirects only. The real
// authorization gates are:
//   1. src/app/(protected)/layout.tsx  — verifies user + profile server-side
//   2. Postgres Row-Level Security     — enforces data access at the database
// (See CVE-2025-29927 for why proxy-layer checks alone are not sufficient.)

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '@/lib/env';

const PUBLIC_PATHS = ['/login'];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Scaffold mode: no Supabase project yet — let pages render their setup notice.
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Do NOT add code between createServerClient and getUser() — it can cause
  // random session logouts. Always use getUser() (verified server-side),
  // never getSession() (reads unverified cookie data).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  if (user && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }
  return response;
}
