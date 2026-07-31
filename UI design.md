You are a lead UI/UX engineer building a modern, retro-editorial web application for a school management system (SOAMS).

### 🎯 Design Vision: "Retro-Editorial Digital Stationery"
Combine a playful retro desktop/OS layout (PostHog style) with high-legibility, structured editorial card containers (CauseHouse style). The UI must feel like a crisp, tactile digital binder that replaces manual paperwork for ~250 students and ~40 teachers.

---

### 🎨 Key Aesthetics & UI Guidelines

1. **Color Palette & Containers:**
   - Background: Warm off-white / bone (`#f7f7f4`).
   - Cards: Pure white with thin 1px crisp dark borders (`#e4e4e7`).
   - Typography: High-contrast charcoal text (`#18181b`) with clean, modern monospaced subtext and badge labels.
   - Accents: Retro pill badges for status tags:
     - `WT` (Working Towards - Amber)
     - `WW` (Working Within - Green)
     - `WA` (Working Above - Indigo/Blue)

2. **Top Navigation & Global Search:**
   - Sticky top bar with school branding ("British International School"), active term indicator, user role switcher (Admin / Main Teacher / Subject Teacher / Special Needs), and a `⌘K` Universal Search Bar.
   - Searching a student name opens a quick summary overlay showing overall attendance, subject progress, and a "Print PDF Certificate" button.

3. **Horizontal Module Tabs:**
   - High-density top tabs for switching views:
     - `[ 📋 Daily Attendance ]`
     - `[ 📊 Standards Marksheet (WT/WW/WA) ]`
     - `[ 📝 Lesson Plan Drafts ]`
     - `[ ⭐ Special Needs IEP Logs ]`
     - `[ 📢 Admin Notice Board ]`

4. **Excel-Style Bulk Evaluation Grid:**
   - Spreadsheet layout optimized for speed.
   - Keyboard navigation support (Arrow keys, Enter, Tab).
   - Clickable interactive pill selectors for curriculum criteria (`WT` | `WW` | `WA`).
   - Real-time auto-saving status indicator ("Saved 2s ago").

5. **Integrated Teacher Scratchpad:**
   - A collapsible side notes drawer attached to class views for logging continuous unstructured notes, daily reminders, or student observations.

---

### 🛠️ Key Components to Deliver

1. **`RetroEditorialShell.tsx`**: Main layout wrapper rendering the warm backdrop, top navigation bar, command-K search, and tab interface.
2. **`StudentSearchModal.tsx`**: Search overlay rendering student quick stats, attendance percentage, and 1-click PDF certificate export.
3. **`ExcelEvaluationGrid.tsx`**: Spreadsheet-like component for quick `WT/WW/WA` standards mark entry with auto-save indicators.
4. **`TeacherScratchpad.tsx`**: Quick note-taking card for class-wide or student-specific observations.

Start by rendering `RetroEditorialShell.tsx` and the `ExcelEvaluationGrid.tsx` using Next.js (App Router), Tailwind CSS, and Lucide React icons.