-- TCIMS — Pin interactions: comments, point-of-interest flag, and removal reports.
-- Depends on 0001_init.sql (incidents) + 0002 (auth/profiles).
-- Safe to re-run: IF NOT EXISTS / CREATE OR REPLACE where possible.

-- 1) Point-of-interest flag on incidents (right-click -> "Mark as POI").
alter table public.incidents
  add column if not exists is_poi boolean not null default false;

create index if not exists incidents_poi_idx
  on public.incidents (is_poi);

-- 2) Comments left on a pin (right-click -> "Leave a message").
create table if not exists public.incident_comments (
  id          uuid primary key default uuid_generate_v4(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists incident_comments_incident_idx
  on public.incident_comments (incident_id);

alter table public.incident_comments enable row level security;

-- Anyone can read comments (community thread is public).
drop policy if exists "comments_select_public" on public.incident_comments;
create policy "comments_select_public"
  on public.incident_comments for select
  using (true);

-- Authenticated users can post comments; user_id forced to caller.
drop policy if exists "comments_insert_auth" on public.incident_comments;
create policy "comments_insert_auth"
  on public.incident_comments for insert
  with check (auth.uid() = user_id or user_id is null);

-- Authors can delete their own comments.
drop policy if exists "comments_delete_owner" on public.incident_comments;
create policy "comments_delete_owner"
  on public.incident_comments for delete
  using (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, delete on public.incident_comments to anon, authenticated;

-- 3) Removal reports (right-click -> "Report for removal"). The pin stays
--    visible; an admin reviews the report later. status gates moderation.
create table if not exists public.incident_reports (
  id           uuid primary key default uuid_generate_v4(),
  incident_id  uuid not null references public.incidents(id) on delete cascade,
  reporter_id  uuid references auth.users(id) on delete set null,
  reason       text not null,
  status       text not null default 'open'
                 check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at   timestamptz not null default now()
);

create index if not exists incident_reports_incident_idx
  on public.incident_reports (incident_id);

alter table public.incident_reports enable row level security;

-- Reporters can see their own reports; everyone can see the count via a view
-- if needed later. For now: reporter-only read (admin role added later).
drop policy if exists "reports_select_reporter" on public.incident_reports;
create policy "reports_select_reporter"
  on public.incident_reports for select
  using (auth.uid() = reporter_id);

-- Authenticated users can file a report.
drop policy if exists "reports_insert_auth" on public.incident_reports;
create policy "reports_insert_auth"
  on public.incident_reports for insert
  with check (auth.uid() = reporter_id or reporter_id is null);

grant usage on schema public to anon, authenticated;
grant select, insert on public.incident_reports to anon, authenticated;

-- Helper: atomically append a photo URL to an incident's photos[] array.
-- Avoids read-modify-write races when multiple uploads happen at once.
create or replace function public.append_incident_photo(
  p_incident_id uuid,
  p_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.incidents
  set photos = coalesce(photos, '{}'::text[]) || p_url
  where id = p_incident_id;
end;
$$;

grant execute on function public.append_incident_photo(uuid, text) to anon, authenticated;
