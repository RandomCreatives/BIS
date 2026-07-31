# Software Requirements Document (SRD)

## Project Title: School Operations & Academic Management System (SOAMS)
**Target Scope:** 12 Classes | ~250 Students | ~35–40 Staff Members  
**Evaluation Model:** Standards-Based Curriculum Attainment & Work Habits  
**Document Version:** 1.1  

---

## 1. System Overview & Objectives

The goal of this system is to transition school operational workflows from paper records and Microsoft Publisher (`.pub`) files to a centralized, web-based management platform.

### Core Objectives:
* Automate daily attendance tracking per class for main teachers.
* Streamline standards-based evaluation entry across subject teachers (Working Towards, Working Within, Working Above)[cite: 32].
* Automatically generate consolidated 3-Term Student Report Certificates in PDF format, replacing manual desktop publishing workflows.
* Standardize weekly lesson plan submissions and administrative approval workflows.
* Provide dedicated individual progress logging for Special Needs students and assigned teachers.
* Facilitate direct Admin-to-Teacher communication via a centralized notice board.

---

## 2. User Roles & Access Control Matrix

| User Role | Count / Scope | System Permissions & Responsibilities |
| :--- | :--- | :--- |
| **School Admin** | System-wide | Full administrative access. Manages staff accounts, class assignments, subject criteria, reviews lesson plans, posts system announcements, and oversees all reports. |
| **Main Teacher** | 12 Teachers | Marks daily class attendance, inputs Work Habits and general summary remarks, reviews consolidated subject evaluations, and generates term certificates. |
| **Assistant Teacher** | 12 Teachers | Secondary access to assigned class attendance logs and student roster management. |
| **Subject Teacher** | Specialized (*Amharic, English, French, Fine Art, PE, ICT*) | Submits weekly lesson plans for assigned subjects; inputs term curriculum attainment scores across classes. |
| **Special Needs Teacher**| ~7 Teachers | Accesses dedicated Individualized Education Plan (IEP) progress logs and qualitative notes for specifically assigned students. |

---

## 3. Functional Requirements

### Module 1: Authentication & User Management
* **FR-1.1:** Secure Email/Password authentication with Role-Based Access Control (RBAC).
* **FR-1.2:** Admin interface to manage staff profiles, class allocations, subject assignments, and student registrations.

### Module 2: Daily Attendance Tracking
* **FR-2.1:** Class-specific daily attendance grid for Main Teachers (and Assistant Teachers).
* **FR-2.2:** Status flags: `Present`, `Absent`, `Late`, `Excused`.
* **FR-2.3:** Automated accumulation of term attendance counts for inclusion in end-of-term student certificates.

### Module 3: Standards-Based Evaluation & Certificate Engine
* **FR-3.1 Term Criteria Definition:** Admin or Subject Leads configure specific curriculum learning objectives per subject and grade for each of the 3 terms.
* **FR-3.2 Curriculum Attainment Assessment:** Subject Teachers evaluate students against learning outcomes using standardized performance levels[cite: 32]:
  * **WT** — Working Towards (the expected level for the grade) [cite: 32]
  * **WW** — Working Within (the expected level for the grade) [cite: 32]
  * **WA** — Working Above (the expected level for the grade) [cite: 32]
* **FR-3.3 Work Habits Evaluation:** Main Teachers assign qualitative scores and general narrative remarks[cite: 31]:
  * **E** — Excellent [cite: 31]
  * **G** — Good [cite: 31]
  * **S** — Satisfactory [cite: 31]
  * **N** — Needs Improvement [cite: 31]
* **FR-3.4 Automated PDF Certificate Generation:** System dynamically generates standardized, printable PDF report cards replacing legacy Microsoft Publisher templates, including signature lines and evaluation legends[cite: 31, 32, 33].

### Module 4: Weekly Lesson Planning
* **FR-4.1 Submission Engine:** Teachers select Term (1–3), Week (1–12), Subject, and Class to enter or upload lesson plans.
* **FR-4.2 Plan Review Pipeline:** Admin dashboard queue displaying plan statuses (`Draft`, `Submitted`, `Approved`, `Needs Revision`) with feedback notes.

### Module 5: Special Needs Student Management
* **FR-5.1 Student Flagging:** System flag identifying Special Needs students (`is_special_needs = True`).
* **FR-5.2 1-on-1 Allocation:** Association of individual Special Needs Teachers to specific assigned students.
* **FR-5.3 IEP & Qualitative Logging:** Private log interface for continuous behavioral tracking, progress milestones, and IEP targets.

### Module 6: Communication Hub
* **FR-6.1 Broadcast Notice Board:** Admin ability to publish targeted announcements (All Staff, Main Teachers, Subject Teachers, or Individual Staff).
* **FR-6.2 Read Receipts:** Tracking system ensuring staff acknowledge and view administrative notices.

---

## 4. Data Model Schema

### Primary Database Entities

1. **`users`**: Stores user authentication data, roles (`Admin`, `Main_Teacher`, `Assistant_Teacher`, `Subject_Teacher`, `Special_Needs_Teacher`), and contact details.
2. **`classes`**: Grade/class entities (12 total), linking `main_teacher_id` and `assistant_teacher_id`.
3. **`students`**: Student records (~250 total) linked to `class_id`, featuring `is_special_needs` boolean and optional `assigned_special_teacher_id`.
4. **`subjects`**: Core and specialized subjects (*Amharic, English, French, Fine Art, PE, ICT*, etc.).
5. **`attendance`**: Daily records storing `student_id`, `date`, `status`, and `marked_by`.
6. **`term_criteria`**: Subject learning outcomes per term (`id`, `subject_id`, `grade_level`, `term`, `criterion_description`).
7. **`student_evaluations`**: Evaluation entries linking `student_id` and `criteria_id` with `attainment_level` (`WT`, `WW`, `WA`)[cite: 32].
8. **`work_habits_and_remarks`**: Term records linking `student_id` with `habit_rating` (`E`, `G`, `S`, `N`), teacher summary remarks, and term attendance totals[cite: 31].
9. **`lesson_plans`**: Weekly plan records (`id`, `teacher_id`, `subject_id`, `class_id`, `term`, `week_number`, `content_or_url`, `status`, `admin_feedback`).
10. **`announcements`**: System notices (`id`, `sender_id`, `target_role`, `title`, `content`, `created_at`).

---

## 5. Non-Functional Requirements

* **Performance:** Sub-2-second response times across core web actions; batch PDF generation in seconds.
* **Usability:** Mobile-first, responsive design for quick attendance marking on phones/tablets.
* **Security & Access Control:** Strict Row-Level Security (RLS) ensuring teachers access only their assigned classes, subjects, or special needs students.
* **Reliability:** Data backup schedules and cloud storage for document attachments.