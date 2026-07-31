'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isValidISODate } from '@/lib/config';

const STATUSES = new Set(['present', 'absent', 'late', 'excused']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SaveAttendanceInput {
  classId: string;
  date: string; // YYYY-MM-DD
  records: { studentId: string; status: string }[];
}

export interface SaveResult {
  ok: boolean;
  message: string;
  saved?: number;
}

/**
 * Batch-save one class register for one date. Row-level security does the
 * real authorization (main/assistant teacher of the class, or admin) — a
 * denied write surfaces as an RLS error and is translated below.
 *
 * Upsert key: UNIQUE(student_id, date) — re-saving the same date edits the
 * register in place rather than duplicating rows.
 */
export async function saveAttendance(input: SaveAttendanceInput): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Your session expired. Please sign in again.' };

  // --- input validation (server-side; never trust the client) ---
  if (!UUID_RE.test(input.classId)) return { ok: false, message: 'Invalid class reference.' };
  if (!isValidISODate(input.date)) return { ok: false, message: 'Invalid date.' };
  if (!Array.isArray(input.records) || input.records.length === 0) {
    return { ok: false, message: 'Nothing to save — mark at least one student.' };
  }
  if (input.records.length > 500) return { ok: false, message: 'Too many rows in one save.' };

  const rows: {
    student_id: string;
    class_id: string;
    date: string;
    status: string;
    marked_by: string;
  }[] = [];
  for (const r of input.records) {
    if (!UUID_RE.test(r.studentId)) return { ok: false, message: 'Invalid student reference.' };
    if (!STATUSES.has(r.status)) return { ok: false, message: `Invalid status: "${r.status}".` };
    rows.push({
      student_id: r.studentId,
      class_id: input.classId,
      date: input.date,
      status: r.status,
      marked_by: user.id, // audit: last editor wins on re-save
    });
  }

  const { error } = await supabase
    .from('daily_attendance')
    .upsert(rows, { onConflict: 'student_id,date' });

  if (error) {
    const friendly = error.message.includes('row-level security')
      ? 'Not allowed: only the main or assistant teacher of this class (or Admin) can edit this register.'
      : error.message;
    return { ok: false, message: friendly };
  }

  revalidatePath('/attendance');
  return { ok: true, message: 'Saved.', saved: rows.length };
}
