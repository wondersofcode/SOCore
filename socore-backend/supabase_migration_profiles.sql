-- Run this once in Supabase Dashboard → SQL Editor.
-- Creates a `profiles` table linked to Supabase Auth's built-in `auth.users`,
-- and a trigger that auto-creates a profile (default role 'analyst') the
-- moment someone signs up — so the backend never has to guess a role.

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text,
  role          text not null default 'analyst' check (role in ('analyst', 'admin')),
  created_at    timestamptz not null default now()
);

-- Auto-create a profile row whenever a new user signs up via Supabase Auth.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (new.id, new.email, split_part(new.email, '@', 1), 'analyst')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 🔴 TODO-DOLDUR: özünü admin et (aşağıdakı email-i öz login email-inlə əvəz et,
-- Supabase-də qeydiyyatdan keçdikdən sonra bu sətri işlət):
-- update public.profiles set role = 'admin' where email = 'sənin@emailin.com';
