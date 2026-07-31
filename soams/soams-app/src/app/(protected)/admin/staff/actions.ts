'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/data';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES = new Set([
  'admin',
  'principal',
  'main_teacher',
  'assistant_teacher',
  'subject_teacher',
  'special_needs_teacher',
]);

function back(path: string, ok: boolean, msg: string): never {
  redirect(`${path}?ok=${ok ? '1' : '0'}&msg=${encodeURIComponent(msg)}`);
}

export async function updateStaff(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) back('/admin/staff', false, 'Admin access required.');

  const id = String(formData.get('id') ?? '');
  const formPath = `/admin/staff/${id}`;
  const fullName = String(formData.get('full_name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const role = String(formData.get('role') ?? '');
  const isActive = formData.get('is_active') === 'on';

  if (!UUID_RE.test(id)) back('/admin/staff', false, 'Invalid staff member.');
  if (!fullName) back(formPath, false, 'Full name is required.');
  if (fullName.length > 255) back(formPath, false, 'Full name is too long.');
  if (phone && phone.length > 50) back(formPath, false, 'Phone number is too long.');
  if (!ROLES.has(role)) back(formPath, false, 'Invalid role.');

  // Safety rails: an admin must not lock or demote themselves.
  if (id === admin.userId) {
    if (!isActive) back(formPath, false, 'You cannot deactivate your own account.');
    if (role !== 'admin') back(formPath, false, 'You cannot remove your own admin role.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, phone, role, is_active: isActive })
    .eq('id', id);

  if (error) back(formPath, false, `Could not save: ${error.message}`);
  back('/admin/staff', true, `${fullName} updated.`);
}
