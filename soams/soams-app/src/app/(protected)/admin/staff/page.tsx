import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentContext } from '@/lib/data';
import { ROLE_LABELS, type Role } from '@/lib/roles';
import { MessageBanner, PageHeader } from '@/components/forms';

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; msg?: string }>;
}) {
  const params = await searchParams;
  const { user, profile } = await getCurrentContext();
  if (!user || !profile) return null;
  if (profile.role !== 'admin') redirect('/admin');

  const supabase = await createClient();
  const { data: staff } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, is_active')
    .order('full_name');

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff"
        subtitle={`${(staff ?? []).length} accounts`}
      />
      <MessageBanner params={params} />

      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
        <p className="font-semibold">➕ Adding a new staff member</p>
        <p className="mt-1">
          Invites happen in Supabase (Dashboard → Authentication → Add user → Send invitation)
          with user metadata <code className="rounded bg-brand-100 px-1 font-mono text-xs">
          {`{"full_name": "Their Name", "role": "main_teacher"}`}</code> — the profile row is
          created automatically and appears here for editing.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(staff ?? []).map((s) => (
              <tr key={s.id} className={`hover:bg-slate-50 ${s.is_active ? '' : 'opacity-50'}`}>
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  {s.full_name}
                  {s.id === user.id && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{s.email}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {ROLE_LABELS[s.role as Role] ?? s.role}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {s.is_active ? (
                    <span className="text-xs font-semibold text-emerald-600">active</span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">deactivated</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/admin/staff/${s.id}`} className="font-semibold text-brand-700 hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
