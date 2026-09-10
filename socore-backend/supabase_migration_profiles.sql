-- Run this in Supabase Dashboard -> SQL Editor.
-- Safe to re-run any time (every statement is idempotent) — re-paste the
-- whole file after pulling changes instead of tracking which lines are new.
--
-- Creates a `profiles` table linked to Supabase Auth's built-in `auth.users`,
-- and a trigger that auto-creates a profile the moment someone signs up — so
-- the backend never has to guess a role or approval status.

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text,
  role          text not null default 'analyst',
  created_at    timestamptz not null default now()
);

-- ── Registration approval (status) ──────────────────────────────────────────
-- New signups land as 'pending' and can't call any authenticated endpoint
-- (see app/auth.py::get_current_user) until an admin approves them. Existing
-- rows are grandfathered in as 'approved' *before* the default flips to
-- 'pending', so this never locks out accounts that already existed.
alter table public.profiles add column if not exists status text;
update public.profiles set status = 'approved' where status is null;
alter table public.profiles alter column status set default 'pending';
alter table public.profiles alter column status set not null;
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check
  check (status in ('pending', 'approved', 'rejected'));

-- Tracks whether the "new pending user" Slack ping has already fired for this
-- row, so a pending user retrying login doesn't spam the channel every time.
alter table public.profiles add column if not exists slack_notified boolean not null default false;

-- ── Roles (L1 / L2 / admin) ──────────────────────────────────────────────────
-- Existing 'analyst' rows become 'l1_analyst'; the role check widens to the
-- 3-tier model and new signups default to the lowest tier.
update public.profiles set role = 'l1_analyst' where role = 'analyst';
alter table public.profiles alter column role set default 'l1_analyst';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('l1_analyst', 'l2_analyst', 'admin'));

-- ── Profile fields (name, avatar, theme) ────────────────────────────────────
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists theme_preference text not null default 'dark';
alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles add constraint profiles_theme_check
  check (theme_preference in ('dark', 'light'));

-- Auto-create a profile row whenever a new user signs up via Supabase Auth.
-- Deliberately omits `status` and `role` so each keeps its own column
-- default (pending / l1_analyst) instead of hardcoding them twice.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Public read access to the "avatars" Storage bucket (create the bucket
-- itself from Dashboard -> Storage -> New bucket -> name "avatars" -> Public
-- bucket: on, since this can't be scripted from SQL). Users may only write
-- inside a folder named after their own uid, so one analyst can't overwrite
-- another's picture.
drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- 🔴 TODO-DOLDUR: özünü admin et və təsdiqlə (aşağıdakı email-i öz login
-- email-inlə əvəz et, Supabase-də qeydiyyatdan keçdikdən sonra bu sətri
-- işlət):
-- update public.profiles set role = 'admin', status = 'approved' where email = 'sənin@emailin.com';
