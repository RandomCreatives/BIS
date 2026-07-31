'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/data';
import { isValidISODate } from '@/lib/config';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function back(ok: boolean, msg: string): never {
  redirect(`/admin/calendar?ok=${ok ? '1' : '0'}&msg=${encodeURIComponent(msg)}`);
}

/** Create an academic year together with its three terms, in one go. */
export async function createYear(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) back(false, 'Admin access required.');

  const name = String(formData.get('name') ?? '').trim();
  const yStart = String(formData.get('start_date') ?? '');
  const yEnd = String(formData.get('end_date') ?? '');

  if (!name || name.length > 20) back(false, 'Year name is required (e.g. 2027/2028).');
  if (!isValidISODate(yStart) || !isValidISODate(yEnd)) back(false, 'Year dates are required.');
  if (yStart >= yEnd) back(false, 'Year must end after it starts.');

  const ranges: { n: number; start: string; end: string }[] = [];
  for (const n of [1, 2, 3]) {
    const start = String(formData.get(`term${n}_start`) ?? '');
    const end = String(formData.get(`term${n}_end`) ?? '');
    if (!isValidISODate(start) || !isValidISODate(end)) back(false, `Term ${n}: both dates required.`);
    if (start >= end) back(false, `Term ${n} must end after it starts.`);
    ranges.push({ n, start, end });
  }
  // Terms must be chronologically ordered and inside the year (breaks between terms are fine).
  if (ranges[0].start < yStart || ranges[2].end > yEnd) back(false, 'Terms must fall inside the year dates.');
  if (!(ranges[0].end < ranges[1].start && ranges[1].end < ranges[2].start))
    back(false, 'Terms must not overlap and must be in order (breaks between terms are fine).');

  const supabase = await createClient();
  const { data: year, error } = await supabase
    .from('academic_years')
    .insert({ name, start_date: yStart, end_date: yEnd })
    .select('id')
    .single();
  if (error) {
    back(false, error.message.includes('academic_years_name_key')
      ? `Academic year "${name}" already exists.`
      : `Could not create year: ${error.message}`);
  }

  const { error: termError } = await supabase.from('terms').insert(
    ranges.map((t) => ({
      academic_year_id: year.id as string,
      term_number: t.n,
      start_date: t.start,
      end_date: t.end,
    })),
  );
  if (termError) {
    // Clean up the orphan year so the admin can retry without a mess.
    await supabase.from('academic_years').delete().eq('id', year.id as string);
    back(false, `Terms not created: ${termError.message}`);
  }

  back(true, `${name} created with 3 terms — set it as current when ready.`);
}

/** Flip the current-year flag (one year current at a time; partial unique index enforces). */
export async function setCurrentYear(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) back(false, 'Admin access required.');

  const id = String(formData.get('id') ?? '');
  if (!UUID_RE.test(id)) back(false, 'Invalid year.');

  const supabase = await createClient();
  const { error: e1 } = await supabase.from('academic_years').update({ is_current: false }).eq('is_current', true);
  if (e1) back(false, `Could not unset current year: ${e1.message}`);
  const { error: e2 } = await supabase.from('academic_years').update({ is_current: true }).eq('id', id);
  if (e2) back(false, `Could not set current year: ${e2.message}`);

  back(true, 'Current academic year updated. Don\'t forget to create the year\'s classes and enrollments.');
}

/** Lock/unlock a term — locking freezes standards-based evaluation entry (FR/US: term closure). */
export async function setTermLocked(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) back(false, 'Admin access required.');

  const id = String(formData.get('id') ?? '');
  const locked = String(formData.get('locked') ?? '') === '1';
  if (!UUID_RE.test(id)) back(false, 'Invalid term.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('terms')
    .update({ locked_at: locked ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) back(false, `Could not update term: ${error.message}`);

  back(true, locked
    ? 'Term locked — subject teachers can no longer add or edit its evaluations.'
    : 'Term unlocked — evaluation entry is open again.');
}
