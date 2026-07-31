import { upsertClass } from './actions';
import { Field, inputCls, selectCls, Card } from '@/components/forms';
import { SubmitButton } from '@/components/submit-button';

export function ClassForm({
  klass,
  gradeLevels,
  mainTeachers,
  assistantTeachers,
}: {
  klass?: {
    id: string;
    class_name: string;
    grade_level_id: string;
    main_teacher_id: string | null;
    assistant_teacher_id: string | null;
  };
  gradeLevels: { id: string; name: string }[];
  mainTeachers: { id: string; name: string }[];
  assistantTeachers: { id: string; name: string }[];
}) {
  return (
    <Card>
      <form action={upsertClass} className="space-y-4">
        <input type="hidden" name="id" value={klass?.id ?? ''} />

        <Field label="Class name" required hint='e.g. "Year 3 Magenta" — must be unique within the academic year.'>
          <input
            name="class_name"
            defaultValue={klass?.class_name ?? ''}
            required
            maxLength={50}
            className={inputCls}
          />
        </Field>

        <Field label="Grade level" required>
          <select name="grade_level_id" defaultValue={klass?.grade_level_id ?? ''} required className={selectCls}>
            <option value="" disabled>
              — Choose grade —
            </option>
            {gradeLevels.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Main teacher" hint="Role: Main Teacher. Marks the daily register.">
            <select name="main_teacher_id" defaultValue={klass?.main_teacher_id ?? ''} className={selectCls}>
              <option value="">— None —</option>
              {mainTeachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assistant teacher" hint="Role: Assistant Teacher.">
            <select
              name="assistant_teacher_id"
              defaultValue={klass?.assistant_teacher_id ?? ''}
              className={selectCls}
            >
              <option value="">— None —</option>
              {assistantTeachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex justify-end pt-2">
          <SubmitButton>{klass ? 'Save changes' : 'Create class'}</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
