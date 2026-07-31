// Next.js 16 proxy (the successor to middleware.ts).
// Refreshes the Supabase auth session cookie on every request and performs
// optimistic auth redirects. Runs on the Node.js runtime by default.

import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/session';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on all paths except static assets. Auth-bearing pages are also
     * protected by the (protected) layout — this layer is optimistic only.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
