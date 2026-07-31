import { upsertStudent } from './actions';
import { Field, inputCls, selectCls, Card } from '@/components/forms';
import { SubmitButton } from '@/components/submit-button';

// Shared add/edit form (server component; plain form + server action).
export function StudentForm({
  student,
  enrollmentClassId,
  classes,
  snTeachers,
}: {
  student?: {
    id: string;
    full_name: string;
    gender: string | null;
    date_of_birth: string | null;
    is_special_needs: boolean;
    assigned_special_teacher_id: string | null;
    status: string;
  };
  enrollmentClassId?: string;
  classes: { id: string; name: string }[];
  snTeachers: { id: string; name: string }[];
}) {
  return (
    <Card>
      <form action={upsertStudent} className="space-y-4">
        <input type="hidden" name="id" value={student?.id ?? ''} />

        <Field label="Full name" required>
          <input
            name="full_name"
            defaultValue={student?.full_name ?? ''}
            required
            maxLength={255}
            className={inputCls}
            placeholder="e.g. Sara Tesfaye Bekele"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Gender">
            <select name="gender" defaultValue={student?.gender ?? ''} className={selectCls}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field label="Date of birth" hint="Optional">
            <input
              type="date"
              name="date_of_birth"
              defaultValue={student?.date_of_birth ?? ''}
              className={inputCls}
            />
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={student?.status ?? 'active'} className={selectCls}>
              <option value="active">Active</option>
              <option value="transferred">Transferred</option>
              <option value="graduated">Graduated</option>
            </select>
          </Field>
        </div>

        <Field label="Class enrollment (current year)" hint="Leaving this blank unassigns the student for the current year.">
          <select name="class_id" defaultValue={enrollmentClassId ?? ''} className={selectCls}>
            <option value="">— Not enrolled —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="rounded-xl bg-slate-50 p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              name="is_special_needs"
              defaultChecked={student?.is_special_needs ?? false}
              className="h-4 w-4 rounded border-slate-300"
            />
            Special Needs student
          </label>
          <div className="mt-3">
            <Field label="Assigned Special Needs teacher" hint="Only applies when the flag above is checked. Grants that teacher IEP access to this student.">
              <select
                name="assigned_special_teacher_id"
                defaultValue={student?.assigned_special_teacher_id ?? ''}
                className={selectCls}
              >
                <option value="">— None —</option>
                {snTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <SubmitButton>{student ? 'Save changes' : 'Register student'}</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
