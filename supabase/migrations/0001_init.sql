-- TCIMS — Foundation schema (Day 6-7 of project strategy)
-- Postgres + PostGIS, Supabase Auth, Storage for incident photos.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.

-- 1) Enable PostGIS extension
create extension if not exists postgis;
create extension if not exists "uuid-ossp";

-- 2) incidents table
create table if not exists public.incidents (
  id          uuid primary key default uuid_generate_v4(),
  type        text not null,
  title       text,
  description text,
  -- PostGIS point in WGS84 (lng/lat). App sends {lat,lng} -> ST_SetSRID(ST_MakePoint(lng,lat),4326)
  location    geometry(Point, 4326) not null,
  photos      text[] default '{}',
  user_id     uuid references auth.users(id) on delete set null,
  status      text not null default 'open'
                check (status in ('open','in_progress','resolved','rejected')),
  anonymous   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Spatial index for fast geo queries
create index if not exists incidents_location_idx
  on public.incidents using gist (location);

-- 3) Row Level Security
alter table public.incidents enable row level security;

-- Supabase's anon/authenticated roles need explicit grants to even be
-- evaluated against the RLS policies below (RLS does not auto-grant).
grant usage on schema public to anon, authenticated;
grant select on public.incidents to anon, authenticated;
grant insert on public.incidents to anon, authenticated;
grant update, delete on public.incidents to authenticated;

-- Anyone (including anon) can read incidents — community map is public
drop policy if exists "incidents_select_public" on public.incidents;
create policy "incidents_select_public"
  on public.incidents for select
  using (true);

-- Authenticated users can insert; user_id is forced to the caller
drop policy if exists "incidents_insert_auth" on public.incidents;
create policy "incidents_insert_auth"
  on public.incidents for insert
  with check (auth.uid() = user_id or (user_id is null and auth.uid() is not null));

-- Anonymous inserts allowed only when flagged anonymous (no user_id)
drop policy if exists "incidents_insert_anon" on public.incidents;
create policy "incidents_insert_anon"
  on public.incidents for insert
  with check (anonymous = true and user_id is null);

-- Authors (or anon-authored) can update their own rows; admins can update any
drop policy if exists "incidents_update_owner" on public.incidents;
create policy "incidents_update_owner"
  on public.incidents for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "incidents_delete_owner" on public.incidents;
create policy "incidents_delete_owner"
  on public.incidents for delete
  using (auth.uid() = user_id);

-- 4) Storage bucket for incident photos
insert into storage.buckets (id, name, public)
values ('incident-photos', 'incident-photos', true)
on conflict (id) do nothing;

-- Public read of photos
drop policy if exists "photos_select_public" on storage.objects;
create policy "photos_select_public"
  on storage.objects for select
  using (bucket_id = 'incident-photos');

-- Authenticated users can upload photos
drop policy if exists "photos_insert_auth" on storage.objects;
create policy "photos_insert_auth"
  on storage.objects for insert
  with check (bucket_id = 'incident-photos' and auth.role() = 'authenticated');
