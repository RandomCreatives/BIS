// Shared server-side data helpers. All helpers fail soft: when Supabase is
// not configured (or the migration hasn't been run yet) they return null /
// empty instead of throwing, so the scaffold always renders.

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import type { Role } from '@/lib/roles';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
}

/**
 * Current auth user + staff profile. Cached per request (React cache), so the
 * (protected) layout and pages can both call it without extra round-trips.
 */
export const getCurrentContext = cache(async () => {
  if (!isSupabaseConfigured) return { user: null, profile: null as Profile | null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null as Profile | null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('id', user.id)
    .single();

  return { user, profile: (profile as Profile | null) ?? null };
});

/** Row count for a table; null when unavailable. Powered by RLS, so callers
 *  automatically only count rows they're allowed to see. */
export async function safeCount(table: string): Promise<number | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

/** Unread announcement count for the signed-in staff member (bell badge). */
export async function unreadAnnouncementsCount(userId: string): Promise<number | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from('announcement_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .is('read_at', null);
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

/** Current academic year row, or null. Central helper — many modules need it. */
export async function getCurrentYear() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('academic_years')
    .select('id, name, start_date, end_date')
    .eq('is_current', true)
    .single();
  return (data as { id: string; name: string; start_date: string; end_date: string } | null) ?? null;
}

/**
 * Server-action gate for admin-only mutations. Returns null when the caller
 * isn't an admin (actions then return a friendly denial). Never trust the
 * client — always call this inside admin server actions.
 */
export async function requireAdmin(): Promise<{ userId: string } | null> {
  const { user, profile } = await getCurrentContext();
  if (!user || !profile || profile.role !== 'admin') return null;
  return { userId: user.id };
}
