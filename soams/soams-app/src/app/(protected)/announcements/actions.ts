'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function markAnnouncementRead(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!UUID_RE.test(id)) return;

  const supabase = await createClient();
  // RPC sets read_at = now() for the current user only (security-definer in DB).
  await supabase.rpc('mark_announcement_read', { p_announcement_id: id });
  revalidatePath('/announcements');
  revalidatePath('/dashboard');
}
