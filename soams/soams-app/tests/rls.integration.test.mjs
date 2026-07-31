import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { PGlite } from '@electric-sql/pglite';

const MIGRATIONS = [
  '20260731000000_schema_v2.sql',
  '20260801000000_import_students_rpc.sql',
  '20260801010000_security_hardening.sql',
];
const MIGRATIONS_URL = new URL('../supabase/migrations/', import.meta.url);

const ids = {
  admin: '00000000-0000-4000-8000-000000000001',
  main: '00000000-0000-4000-8000-000000000002',
  subject: '00000000-0000-4000-8000-000000000003',
  attacker: '00000000-0000-4000-8000-000000000004',
  student1: '10000000-0000-4000-8000-000000000001',
  student2: '10000000-0000-4000-8000-000000000002',
  class1: '20000000-0000-4000-8000-000000000001',
  class2: '20000000-0000-4000-8000-000000000002',
  announcement: '30000000-0000-4000-8000-000000000001',
};

test('migrations enforce critical RLS and RPC boundaries', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());

  // Minimal Supabase Auth surface required by the schema. The request setting
  // lets each assertion run with the same auth.uid() contract as Supabase.
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb default '{}'::jsonb,
      raw_app_meta_data jsonb default '{}'::jsonb
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  `);

  for (const file of MIGRATIONS) {
    let sql = await readFile(new URL(file, MIGRATIONS_URL), 'utf8');
    // Supabase includes pgcrypto. PGlite provides gen_random_uuid() in core but
    // does not package this extension, so only its CREATE line is omitted here.
    sql = sql.replace(/create extension if not exists pgcrypto;[^\n]*/, '');
    await db.exec(sql);
  }

  // Supabase grants table access to API roles. Reproduce those table grants;
  // function grants remain exactly as declared by the migrations.
  await db.exec(`
    grant usage on schema public, auth to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
  `);

  // raw_user_meta_data must never grant a role. Trusted app metadata is used
  // here only to arrange role fixtures without bypassing the Auth trigger.
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
      ('${ids.admin}', 'admin@example.test', '{"full_name":"Admin"}', '{"role":"admin"}'),
      ('${ids.main}', 'main@example.test', '{"full_name":"Main"}', '{"role":"main_teacher"}'),
      ('${ids.subject}', 'subject@example.test', '{"full_name":"Subject"}', '{"role":"subject_teacher"}'),
      ('${ids.attacker}', 'attacker@example.test', '{"full_name":"Attacker","role":"admin"}', '{}');
  `);
  const attackerProfile = await db.query(
    `select role::text from profiles where id = '${ids.attacker}'`,
  );
  assert.equal(attackerProfile.rows[0].role, 'subject_teacher');

  const contextResult = await db.query(`
    select ay.id as year_id,
           (select id from terms where academic_year_id = ay.id and term_number = 1) as term_id,
           (select id from grade_levels where name = 'Year 1') as grade1,
           (select id from grade_levels where name = 'Year 2') as grade2,
           (select id from subjects where name = 'Mathematics') as subject_id
    from academic_years ay
    where ay.is_current
  `);
  const context = contextResult.rows[0];

  await db.exec(`
    insert into classes (id, class_name, grade_level_id, academic_year_id, main_teacher_id)
    values
      ('${ids.class1}', 'Year 1 Test', '${context.grade1}', '${context.year_id}', '${ids.main}'),
      ('${ids.class2}', 'Year 2 Test', '${context.grade2}', '${context.year_id}', null);
    insert into students (id, full_name) values
      ('${ids.student1}', 'Student One'),
      ('${ids.student2}', 'Student Two');
    insert into enrollments (student_id, class_id, academic_year_id, enrolled_on) values
      ('${ids.student1}', '${ids.class1}', '${context.year_id}', '2026-09-01'),
      ('${ids.student2}', '${ids.class2}', '${context.year_id}', '2026-09-01');
    insert into teaching_assignments (teacher_id, subject_id, class_id)
    values ('${ids.subject}', '${context.subject_id}', '${ids.class1}');
    insert into term_criteria (subject_id, grade_level_id, term_number, description)
    values ('${context.subject_id}', '${context.grade1}', 1, 'Valid criterion');
    insert into announcements (id, sender_id, audience, title, content)
    values ('${ids.announcement}', '${ids.admin}', 'individual', 'Private', 'Private body');
    insert into announcement_recipients (announcement_id, recipient_id)
    values ('${ids.announcement}', '${ids.main}');
  `);
  const criteriaResult = await db.query(
    "select id from term_criteria where description = 'Valid criterion'",
  );
  const criteriaId = criteriaResult.rows[0].id;

  async function asUser(userId, sql) {
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub = '${userId}';`,
    );
    try {
      return await db.query(sql);
    } finally {
      await db.exec('reset role; reset request.jwt.claim.sub;');
    }
  }

  async function denied(userId, sql) {
    await assert.rejects(() => asUser(userId, sql));
  }

  await asUser(
    ids.main,
    `insert into daily_attendance (student_id, class_id, date, status, marked_by)
     values ('${ids.student1}', '${ids.class1}', '2026-09-02', 'present', '${ids.main}')`,
  );
  await denied(
    ids.main,
    `insert into daily_attendance (student_id, class_id, date, status, marked_by)
     values ('${ids.student2}', '${ids.class1}', '2026-09-02', 'present', '${ids.main}')`,
  );
  await denied(
    ids.main,
    `insert into daily_attendance (student_id, class_id, date, status, marked_by)
     values ('${ids.student1}', '${ids.class1}', '2026-09-03', 'present', '${ids.admin}')`,
  );

  await asUser(
    ids.subject,
    `insert into student_evaluations
       (student_id, criteria_id, term_id, attainment, evaluated_by)
     values
       ('${ids.student1}', '${criteriaId}', '${context.term_id}', 'WW', '${ids.subject}')`,
  );
  await denied(
    ids.subject,
    `insert into student_evaluations
       (student_id, criteria_id, term_id, attainment, evaluated_by)
     values
       ('${ids.student2}', '${criteriaId}', '${context.term_id}', 'WW', '${ids.subject}')`,
  );

  await denied(
    ids.subject,
    `insert into term_reports (student_id, term_id, status)
     values ('${ids.student1}', '${context.term_id}', 'draft')`,
  );

  // A role change invalidates a stale teaching assignment immediately.
  await db.exec(`update profiles set role = 'assistant_teacher' where id = '${ids.subject}'`);
  await denied(
    ids.subject,
    `update student_evaluations set attainment = 'WA'
     where student_id = '${ids.student1}' and criteria_id = '${criteriaId}'`,
  );

  await asUser(
    ids.main,
    `insert into term_reports (student_id, term_id, status)
     values ('${ids.student1}', '${context.term_id}', 'draft')`,
  );

  // A class pointer alone does not preserve access after a role change.
  await db.exec(`update profiles set role = 'subject_teacher' where id = '${ids.main}'`);
  const staleClassAccess = await asUser(
    ids.main,
    'select count(*)::int as count from students',
  );
  assert.equal(staleClassAccess.rows[0].count, 0);
  await denied(
    ids.main,
    `insert into daily_attendance (student_id, class_id, date, status, marked_by)
     values ('${ids.student1}', '${ids.class1}', '2026-09-04', 'present', '${ids.main}')`,
  );

  // With no direct UPDATE policy, Postgres hides the row rather than throwing;
  // assert that no recipient identity can be changed.
  const recipientMutation = await asUser(
    ids.main,
    `update announcement_recipients
     set recipient_id = '${ids.attacker}'
     where announcement_id = '${ids.announcement}'
       and recipient_id = '${ids.main}'
     returning recipient_id`,
  );
  assert.equal(recipientMutation.rows.length, 0);
  await asUser(
    ids.main,
    `select mark_announcement_read('${ids.announcement}')`,
  );
  const receipt = await db.query(
    `select read_at from announcement_recipients
     where announcement_id = '${ids.announcement}' and recipient_id = '${ids.main}'`,
  );
  assert.notEqual(receipt.rows[0].read_at, null);

  // Deactivation must constrain even policies that otherwise use USING (true).
  await db.exec(`update profiles set is_active = false where id = '${ids.main}'`);
  const afterDeactivation = await asUser(
    ids.main,
    'select count(*)::int as count from classes',
  );
  assert.equal(afterDeactivation.rows[0].count, 0);
});
