# Online accounts with Supabase (free plan, about 15 minutes)

With this switched on, students register and log in online, their results follow them to any phone or computer, and **you can see every registration and result** in the Supabase dashboard. With it switched off, the site works exactly as before (accounts stay in each student's browser).

## 1. Create the project
1. Sign up at supabase.com (free, no card) and click **New project**. Name it, set a database password (save it), pick the region closest to your students.
2. Wait about two minutes until it says the project is ready.

## 2. Create the tables
1. Left menu, **SQL Editor**, **New query**.
2. Open `supabase/schema.sql` from this project, paste **all** of it, click **Run**. "Success" means done. It is safe to run again.

## 3. Sign-up settings
Left menu **Authentication**, then **Sign In / Providers**, **Email**:
- Turn **Confirm email OFF** if students may use any email (recommended; many students have no email they check). With it ON, each student must click a link in an email before the first login, and the site tells them so.
- Leave the minimum password length at 6 or raise it to 8 (the site already requires 8).

## 4. Connect the site
**Project Settings**, **API**: copy the **Project URL** and the **anon / publishable** key. Paste them into `site/js/core/config.js`:
```js
supabaseUrl: "https://abcdefgh.supabase.co",
supabaseKey: "eyJ...your anon or publishable key...",
```
These two values are meant to be public. **Never paste the `service_role` or "secret" key anywhere in the site or in chat.** It would give anyone full control of your data.
Publish the site again.

## 5. Check that it works (10 minutes)
1. Register a test student on your live site. In Supabase, **Table Editor**, **profiles**: the student appears.
2. Take a practice exam and finish it. Wait a few seconds. **attempts** shows a row with subject, year, type and score.
3. Open the site on another phone or a private window, log in with the same details: the result is in History.
4. Settings, change the password, then log in with the new one.
5. Switch the phone to airplane mode after the exam page loads, finish an exam, switch it back on and open any page: the result uploads.

## What you can do as owner
- **See students and results:** Table Editor (`profiles`, `attempts`). Buttons there export CSV.
- **Run reports:** SQL Editor; example queries are at the bottom of `schema.sql` (registered students, recent attempts, average score per subject).
- **Reset a password or delete a student:** Authentication, Users. Deleting a user removes their profile and results.
- **Back up:** use the CSV export monthly. The free plan has **no automatic backups**.

## How it behaves
- Each student can read and write only their own rows (Row Level Security in the schema). Saved results cannot be edited or deleted from the website.
- Passwords exist only inside Supabase's login system; the browser copy never holds one.
- Exams never wait for the network: results save in the browser first and upload in the background. If the connection is down the upload retries on the next page load.
- Existing browser-only students: the first time they log in with their old email and password, the site creates their online account and uploads their old results, study plan and settings. Nothing is lost.
- Not synced between devices: flashcards, the profile photo and video watched marks (they stay on the device).

## Free-plan limits to remember
500 MB database, 50,000 monthly users, and the project **pauses after one week with no activity** (restart it with one click in the dashboard; until then logins fail with "could not reach the server"). Check the current limits at supabase.com/pricing.

## Try it first without an account
`npm run mock` starts a small stand-in server on your computer. Set `supabaseUrl: "http://localhost:54321"` and any `supabaseKey`, run `npm run serve`, and everything above works against it (memory only; data is lost when you stop it). It is for trying and testing, not for real students.
