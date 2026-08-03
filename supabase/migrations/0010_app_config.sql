-- TCIMS — Registration gate: a config table so admins can toggle signup mode.
-- Depends on 0001–0009. Safe to re-run.

create table if not exists public.app_config (
  key         text primary key,
  value       text not null,
  description text
);

-- Seed the signup mode. 'open' = anyone can register.
-- The user initially chose open self-signup (2026-07-28); lock down later.
insert into public.app_config (key, value, description)
  values ('signup_mode', 'open', 'open | admin_only — who can self-register')
on conflict (key) do nothing;

-- Admins (is_admin = true) can read AND update app_config.
-- Non-admins get no access to the config table.
create policy if not exists "config_read_admin"
  on public.app_config for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );

create policy if not exists "config_write_admin"
  on public.app_config for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );

-- Convenience view for the signup_mode value.
create or replace view public.current_signup_mode as
  select value as signup_mode
  from public.app_config
  where key = 'signup_mode';
