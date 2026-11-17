# Content guide

Content lives in `site/data/`. After any change run `npm run check` (rebuilds indexes, validates) and commit. A failing check blocks the deploy and names the file and item.

## Where things go
| I want to add | Do this |
|---|---|
| A video link | `data/materials/video-g<grade>.json`: add an entry under the subject (or use `studio.html`) |
| A short note | `data/materials/notes-g<grade>.json` |
| A text book or teacher guide | `data/materials/textbook-g<grade>.json` (`"type": "teacher-guide"` for guides) |
| An exam paper | `data/exams/<year>-g<grade>.json`: add a set (Studio can write it). 2017 and 2018 E.C. are offered |
| Another year / subject | Add another set to the same file |
| Exams for a new grade | Add an exam level in `data/catalogue.json`, then add sets |
| A new subject | Add it to `subjects` in `data/catalogue.json` and to the level's list |

Files are created only when they hold content. `index.json` files are generated: never edit them.
**Host PDFs outside the repo** (Google Drive, Telegram, GitHub Releases) and link to them: each PDF in the repo is an extra file.

## Material file
```json
{ "type": "video", "grade": 9, "subjects": { "physics": [
  { "id": "g9-physics-v001", "title": "Motion in a straight line, part 1", "url": "https://www.youtube.com/watch?v=XXXXXXXXXXX",
    "unit": 1, "topic": "speed and velocity", "duration": "14:20", "language": "am", "order": 1,
    "source": "Teacher or channel", "permission": "embed-allowed", "status": "published" } ] } }
```
`id` unique across the whole site, never reused. `status`: `published`, `draft` (hidden) or `coming-soon` (listed, not clickable). `url` must be `https://`.
Grades 11 and 12 entries add `"stream": "natural"` or `"social"`. Subject names shown to students are the supplied labels, per grade.
**Videos:** only YouTube is played inside the site (privacy-enhanced embed, built from the 11-character id). Everything else opens in a new tab. Embed only videos you own, have licensed, or that allow embedding; set `permission`. Never copy videos into the repo.

## Exam file
`{ "year": 2017, "grade": 8, "sets": [ { "id", "level", "subject", "title", "kind", "year", "answerSource", "durationMinutes", "status", "questions": [ { "id", "topic", "question", "options": [...], "answer": 2, "explanation" } ] } ] }`
`answer` is the position of the correct option (0 = first). `answerSource` is `official` or `reasoned`; reasoned papers show an **Unofficial answers** badge.
Optional: `passages` (shared reading text) with a question `passage` key; `image` (https or `assets/` path).

## Settings (`site/js/core/config.js`)
`examYears` (years offered), `saveMockAttempts` (true: Mock attempts are saved in history, progress and dashboard), `googleFormUrl` (contributor form), `supabaseUrl` and `supabaseKey` (online accounts, see SUPABASE-SETUP.md; empty = browser-only).

## What a static site can promise
Question files are readable by anyone, so exams are for practice, not supervised testing. In browser-only mode passwords are hashed in the browser, which stops casual reading but is not real account security. With Supabase switched on, passwords are handled by Supabase and never stored in the browser.

## Manual test checklist (phone and laptop)
Accounts: register (name 2+, valid email, grade 6/8/12, password 8+), duplicate email refused, login, show/hide password, remember email, signed-out redirect, logout, old accounts still load.
Selection: grade cards, region required for 6/8, stream for 12, saved selection restores, Continue disabled until complete.
Exams page: subject cards for the selection, Practice and Mock buttons, **year step (2017/2018)**, empty state with no selection, region edited in Profile still lists subjects.
Taking an exam: setup (15 to 120 min), timer and 5-minute warning, auto-submit at zero, one question at a time, Previous/Next/Clear, navigator drawer, counters, explanation (Practice only), submit confirmation, exit confirmation, missing year shows "not created yet".
Results: score ring and tiers (80+, 50+, below), review filter, retry link (same subject, mode and year), **Mock label**, Study this next.
History / Progress / Dashboard: totals match, filters and four sort orders, trend chart, weak-topic advice, **Mock attempts included and labelled**.
Planner, Flashcards, Profile (photo, region/stream), Settings (theme, password, data download), global search, side menu, theme toggle without flash.
Learning: Resources filters, resource detail, Subject page tabs, video embed and mark watched, Studio output.
