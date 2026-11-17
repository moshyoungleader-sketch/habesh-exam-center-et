# Proposal amendments (v2)

Amends "Habesha Exam Center: Reorganization and Rebuild Proposal" (26 pages) with its Addendum (agreed scope), after re-reading the code and building it. Where this note and the original differ, this note records what was actually built.

## 1. Findings re-checked against the code
Confirmed by reading and running: F1 (grades.html wrote `addis`, profile wrote `Addis Ababa`, dashboard/exams read different spellings), F2 (exam page and subjects.js/backend list different subjects), F3 (progress read `attempt.review`, the exam page wrote `attempt.questions`), F4 (`exam-engine.js` truncated), F5 (dead `subject.html` link), F6, F7 (backend tests 17/17 pass), F8, F11 (13 stylesheets, 712 `.gitkeep`, 803 content-library files, 87 `grade*.js` files; 22 other frontend scripts, not 23), F12.
Correction: the proposal's "5 of 23 scripts run" is 5 of 22 non-bank scripts.

## 2. Addendum applied
| Addendum item | Built as |
|---|---|
| Exams for Grades 6, 8, 12 only; resources for Grades 5 to 12 | `examLevels` in catalogue.json (6 levels); `materialLevels` g5 to g12 |
| Year step after Practice/Mock (2017 E.C. / 2018 E.C.) | Dialog on Exams page; year filters the paper; a missing year shows the existing "not created yet" state, never another year's paper |
| Mock attempts saved (replaces D3) | Saved like Practice with grade, region/stream, subject, set id/title, year, duration, answers, score, correct/incorrect/unanswered counts; labelled **Mock exam** in Results, History, Dashboard; included in Progress; retry link keeps mode and year. Switch off with `saveMockAttempts: false` |
| Exact subject names per level group | `materialLevels[].subjects` hold the supplied labels; Resources filters and Subject pages display them unchanged. Exam subject ids are not renamed |
| Content organised by type, then grade file | `data/materials/video-g<n>.json`, `notes-g<n>.json`, `textbook-g<n>.json` (guides included); exams `data/exams/<year>-g<n>.json` with every subject of that grade. Registered through the generated `index.json` manifests |

## 2b. Defaults chosen for the open decisions (change in one place)
D1 subject list: the `subjects.js`/backend list (matches the one real bank). Note this removes mother tongue, music, visual arts, ethics from the Exams page and adds Afaan Oromo, which is a visible change; add subjects back in catalogue.json once the curriculum is confirmed. D2 hosting: static (GitHub Pages workflow included). D4 video policy: `permission` field, YouTube embed only when `embed-allowed` or `own`, validator warns when missing.

## 3. Changes to the original plan, and why
- **Free-tier fit.** The site is 55 files today (original 1,035). Full content adds up to 24 material files and 5 exam files, so at most about 100 data and page files plus roughly 20 tooling files. Nothing needs a server, a database or an install.
- **Backend replaced by Supabase (optional).** The Node/PostgreSQL server (19 files in the proposal) does not run on free static hosting, so it is not included. Instead `js/core/sync.js` plus `supabase/schema.sql` give real online accounts on the free Supabase plan (see SUPABASE-SETUP.md): sign-up and login, results across devices, owner view in the Supabase dashboard, row-level security, offline-safe saving, and automatic migration of existing browser-only accounts. Tested against the bundled stand-in server (`tools/mock-supabase.js`) in a real browser: register, duplicate email, wrong password, results upload, second device, profile change, offline then online, password change, old-account migration, token refresh, unreachable server, email-confirmation mode. **Not tested against a live Supabase project** (needs your account): follow the check list in SUPABASE-SETUP.md.
- **Regions and streams live in `js/core/config.js`**, not catalogue.json, because pages need them synchronously (aliases cure F1). Subjects, levels and resource types are in catalogue.json.
- **Classic scripts, not ES modules** (`window.HEC` namespace), so the same code works on any static host. Data still needs a web server (`fetch`), as before.
- **Three stylesheets, not four.** `theme.css`, `pages.css` (every page's old inline CSS, each rule scoped with `:where()` so specificity is unchanged, `:root` colour variables kept on `:root`) and `exam.css`. A "shared base" file was tried and dropped: it applied rules to pages that never had them.
- **Not implemented:** mark-for-review and draft autosave (their config flags were removed rather than left inert), offline service worker, announcements on the home page, Amharic/Afaan Oromo interface labels. Passwords are hashed with PBKDF2 where Web Crypto exists; old plain-text accounts upgrade on next sign-in.
- Materials folders are empty at launch (no verified links existed). Exams page, Subject page, Studio and Resources are ready for data.

## 4. Fixes visible to students
F1 region saved in one canonical form (`addis-ababa`), old spellings still read; F3 weak-topic advice works for old and new attempts; F5 `subject.html` now exists; F10 Unofficial answers badge; F6 loader no longer needs two sibling folders.

## 5. Verification
`npm test`: 11 parity tests (golden grading identical on the real 60 questions, timer with a fake clock, old-account fixture, storage keys unchanged, alias cases, Mock saving). Browser run with zero console errors across register, selection, year step, practice, mock, results, history, progress, dashboard, resources, subject and studio pages. Screenshots of all 17 original pages at laptop and phone width in light and dark: 48 of 68 pixel-identical; the rest differ only where intended (Exams subject list, Results "Study this next", Resources empty state, Progress advice).
Not done: the manual phone checklist in CONTENT-GUIDE.md, and real-content testing (only sample data in a scratch copy).
