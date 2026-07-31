import { markAnnouncementRead } from './actions';
import { createClient } from '@/lib/supabase/server';
import { getCurrentContext } from '@/lib/data';

// Announcements — the one fully working module in this scaffold.
// Demonstrates the materialized-recipient + read-receipt pattern end to end:
// rows in announcement_recipients are the source of both visibility (RLS)
// and acknowledgement (read_at).

interface Notice {
  announcement_id: string;
  read_at: string | null;
  title: string;
  content: string;
  created_at: string;
  sender: string;
}

export default async function AnnouncementsPage() {
  const { user } = await getCurrentContext();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('announcement_recipients')
    .select(
      'read_at, announcement_id, announcement:announcements(title, content, created_at, sender:profiles!sender_id(full_name))',
    )
    .eq('recipient_id', user.id);

  const notices: Notice[] = (data ?? [])
    .map((row) => {
      const a = Array.isArray(row.announcement) ? row.announcement[0] : row.announcement;
      if (!a) return null;
      const sender = Array.isArray(a.sender) ? a.sender[0] : a.sender;
      return {
        announcement_id: row.announcement_id as string,
        read_at: row.read_at as string | null,
        title: a.title as string,
        content: a.content as string,
        created_at: a.created_at as string,
        sender: (sender?.full_name as string) ?? 'Administration',
      };
    })
    .filter((n): n is Notice => n !== null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
        <p className="mt-1 text-sm text-slate-600">
          Notices from the school administration. Unread notices are
          highlighted — tap &quot;Mark as read&quot; to acknowledge (FR-6.2 read
          receipts).
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">Couldn&apos;t load announcements.</p>
          <p className="mt-1">
            If you haven&apos;t run the schema migration yet, open the Supabase
            SQL Editor and run{' '}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
              supabase/migrations/20260731000000_schema_v2.sql
            </code>
            , then refresh. ({error.message})
          </p>
        </div>
      )}

      {!error && notices.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          No notices yet. When Admin or the Principal publishes one, it will
          appear here.
        </div>
      )}

      <ul className="space-y-3">
        {notices.map((n) => (
          <li
            key={n.announcement_id}
            className={`rounded-xl border p-5 shadow-sm ${
              n.read_at
                ? 'border-slate-200 bg-white'
                : 'border-brand-300 bg-brand-50'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  {!n.read_at && (
                    <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      New
                    </span>
                  )}
                  <h2 className="font-semibold text-slate-900">{n.title}</h2>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                  {n.content}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  {n.sender} · {new Date(n.created_at).toLocaleDateString()}
                </p>
              </div>
              {!n.read_at && (
                <form action={markAnnouncementRead}>
                  <input type="hidden" name="id" value={n.announcement_id} />
                  <button
                    type="submit"
                    className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-800"
                  >
                    Mark as read
                  </button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
