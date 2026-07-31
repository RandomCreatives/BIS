import { RetroEditorialShell } from '@/components/retro-editorial-shell';
import { getCurrentYear } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import type { Profile } from '@/lib/data';

// Server shell for every (protected) page. Resolves the active-term label
// (year + term dates) and hands it to the client editorial shell.
export async function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  let termLabel: string | null = null;
  let currentYearId: string | null = null;

  if (isSupabaseConfigured) {
    try {
      const year = await getCurrentYear();
      if (year) {
        currentYearId = year.id;
        const supabase = await createClient();
        const { data: terms } = await supabase
          .from('terms')
          .select('term_number, start_date, end_date')
          .eq('academic_year_id', year.id);
        const today = new Date().toISOString().slice(0, 10);
        const active = (terms ?? []).find(
          (t) => t.start_date <= today && today <= t.end_date,
        ) as { term_number: number; start_date: string; end_date: string } | undefined;
        termLabel = active ? `Term ${active.term_number} · ${year.name}` : year.name;
      }
    } catch {
      termLabel = null;
    }
  }

  return (
    <RetroEditorialShell profile={profile} termLabel={termLabel} currentYearId={currentYearId}>
      {children}
    </RetroEditorialShell>
  );
}
