import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentContext } from '@/lib/data';
import { ROLE_LABELS, type Role } from '@/lib/roles';
import { MessageBanner, PageHeader, Field, inputCls, selectCls, Card } from '@/components/forms';
import { SubmitButton } from '@/components/submit-button';
import { updateStaff } from '../actions';

export default async function EditStaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; msg?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { user, profile } = await getCurrentContext();
  if (!user || !profile) return null;
  if (profile.role !== 'admin') redirect('/admin');

  const supabase = await createClient();
  const { data: staff } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, is_active')
    .eq('id', id)
    .single();
  if (!staff) notFound();

  const isSelf = staff.id === user.id;

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader
        title={`Edit — ${staff.full_name}`}
        subtitle={String(staff.email)}
        action={
          <Link href="/admin/staff" className="text-sm font-semibold text-brand-700 hover:underline">
            ← All staff
          </Link>
        }
      />
      <MessageBanner params={sp} />

      <Card>
        <form action={updateStaff} className="space-y-4">
          <input type="hidden" name="id" value={staff.id} />

          <Field label="Full name" required>
            <input name="full_name" defaultValue={String(staff.full_name)} required className={inputCls} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role" hint="Drives module access and RLS permissions.">
              <select name="role" defaultValue={String(staff.role)} className={selectCls} disabled={isSelf}>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <option key={r} value={r} disabled={isSelf && r !== 'admin'}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              {isSelf && <input type="hidden" name="role" value="admin" />}
            </Field>
            <Field label="Phone" hint="Optional">
              <input name="phone" defaultValue={String(staff.phone ?? '')} className={inputCls} />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={Boolean(staff.is_active)}
              disabled={isSelf}
              className="h-4 w-4 rounded border-slate-300"
            />
            Active account
          </label>
          {isSelf && (
            <p className="text-xs text-slate-500">
              You can&apos;t deactivate or demote your own admin account.
            </p>
          )}
          {!staff.is_active && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              Deactivated staff can no longer sign in; their historical data is preserved.
            </p>
          )}

          <div className="flex justify-end pt-2">
            <SubmitButton>Save changes</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
