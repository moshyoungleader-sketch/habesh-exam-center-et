-- Habesha Exam Center: Supabase schema. Paste this whole file into Supabase > SQL Editor > Run (safe to run again).
-- Students sign up through Supabase Auth. These two tables hold their profile and exam attempts.
-- Row Level Security means each student can only ever read or write THEIR OWN rows. You, the owner, see everything in the dashboard.

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text not null default '',
  grade       text not null default '' check (grade in ('', '6', '8', '12')),
  region      text not null default '' check (region in ('', 'amhara', 'addis-ababa')),
  stream      text not null default '' check (stream in ('', 'natural', 'social')),
  preferences jsonb not null default '{}'::jsonb,
  study_plan  jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.attempts (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  data        jsonb not null check (octet_length(data::text) < 400000),   -- the full attempt: answers and per-question review
  subject     text,
  grade       text,
  exam_type   text,            -- practice or mock
  exam_year   int,             -- E.C. year, e.g. 2017
  percentage  int,
  created_at  timestamptz not null default now()
);
create index if not exists attempts_user_idx on public.attempts (user_id, created_at);

alter table public.profiles enable row level security;
alter table public.attempts enable row level security;

drop policy if exists "profile: read own"   on public.profiles;
drop policy if exists "profile: insert own" on public.profiles;
drop policy if exists "profile: update own" on public.profiles;
create policy "profile: read own"   on public.profiles for select using (auth.uid() = id);
create policy "profile: insert own" on public.profiles for insert with check (auth.uid() = id);
create policy "profile: update own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "attempts: read own"   on public.attempts;
drop policy if exists "attempts: insert own" on public.attempts;
create policy "attempts: read own"   on public.attempts for select using (auth.uid() = user_id);
create policy "attempts: insert own" on public.attempts for insert with check (auth.uid() = user_id);
-- No update or delete policy for students: saved results cannot be edited or removed from the website.

-- When someone registers, create their profile automatically (works whether or not email confirmation is switched on).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, grade)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          case when new.raw_user_meta_data->>'grade' in ('6', '8', '12') then new.raw_user_meta_data->>'grade' else '' end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Useful owner queries (run in the SQL Editor, not from the website):
--   select count(*) from public.profiles;                                   -- registered students
--   select full_name, email, grade, created_at from public.profiles order by created_at desc;
--   select p.full_name, a.subject, a.exam_type, a.exam_year, a.percentage, a.created_at
--     from public.attempts a join public.profiles p on p.id = a.user_id order by a.created_at desc limit 50;
--   select subject, exam_type, round(avg(percentage)) as avg_score, count(*) from public.attempts group by 1, 2;
