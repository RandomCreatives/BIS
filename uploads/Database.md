-- 1. ENUMS FOR ROLES AND EVALUATIONS
CREATE TYPE user_role AS ENUM (
  'admin', 
  'main_teacher', 
  'assistant_teacher', 
  'subject_teacher', 
  'special_needs_teacher'
);

CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE attainment_level AS ENUM ('WT', 'WW', 'WA'); -- Working Towards, Within, Above
CREATE TYPE habit_grade AS ENUM ('E', 'G', 'S', 'N'); -- Excellent, Good, Satisfactory, Needs Improvement
CREATE TYPE plan_status AS ENUM ('draft', 'submitted', 'approved', 'needs_revision');

-- 2. USERS / PROFILES TABLE
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'subject_teacher',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CLASSES TABLE (12 total)
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name VARCHAR(50) NOT NULL UNIQUE, -- e.g. "Year 3 Magenta"
  main_teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assistant_teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- 4. STUDENTS TABLE (~250 total)
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  gender VARCHAR(10),
  date_of_birth DATE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  is_special_needs BOOLEAN DEFAULT FALSE,
  assigned_special_teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. SUBJECTS TABLE
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_name VARCHAR(100) NOT NULL UNIQUE -- Amharic, English, French, Fine Art, PE, ICT, etc.
);

-- 6. DAILY ATTENDANCE
CREATE TABLE daily_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status attendance_status NOT NULL,
  marked_by UUID REFERENCES profiles(id),
  UNIQUE(student_id, date)
);

-- 7. TERM CRITERIA (Defined per Subject/Grade/Term)
CREATE TABLE term_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  term INT CHECK (term IN (1, 2, 3)),
  criterion_description TEXT NOT NULL
);

-- 8. STUDENT EVALUATIONS (Standards-Based Entry: WT, WW, WA)
CREATE TABLE student_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  criteria_id UUID REFERENCES term_criteria(id) ON DELETE CASCADE,
  attainment attainment_level NOT NULL,
  evaluated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, criteria_id)
);

-- 9. WORK HABITS & GENERAL REMARKS (Per Term Certificate)
CREATE TABLE term_summary_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  term INT CHECK (term IN (1, 2, 3)),
  academic_year VARCHAR(20) NOT NULL, -- e.g. "2025/2026"
  work_habit_grade habit_grade DEFAULT 'S',
  teacher_remarks TEXT,
  main_teacher_signed BOOLEAN DEFAULT FALSE,
  principal_signed BOOLEAN DEFAULT FALSE,
  UNIQUE(student_id, term, academic_year)
);

-- 10. WEEKLY LESSON PLANS
CREATE TABLE lesson_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  term INT CHECK (term IN (1, 2, 3)),
  week_number INT CHECK (week_number BETWEEN 1 AND 12),
  plan_content TEXT,
  file_url TEXT,
  status plan_status DEFAULT 'draft',
  admin_feedback TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE
);

-- 11. ANNOUNCEMENTS & COMMUNICATION
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES profiles(id),
  target_role VARCHAR(50) DEFAULT 'ALL', -- 'ALL', 'MAIN_TEACHER', 'SUBJECT_TEACHER', etc.
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);