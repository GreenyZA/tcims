-- TCIMS — Auth, Profiles & Property Claims (Land-Owner feature stream)
-- Depends on 0001_init.sql (incidents table + PostGIS + RLS + storage).
-- Safe to re-run: IF NOT EXISTS / DROP POLICY IF EXISTS.

-- 1) profiles: 1:1 with auth.users, holds the public display username.
--    Supabase Auth uses email as the login identity; username is a display handle.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null unique,
  display_name text,
  created_at timestamptz not null default now()
);

create index if not exists profiles_username_idx on public.profiles (username);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    -- Derive an initial username from the email local-part; user can change later.
    split_part(new.email, '@', 1),
    split_part(new.email, '@', 1)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS for profiles
alter table public.profiles enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

-- A user can insert/update only their own profile.
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 2) properties: land-owner claimed plots (PostGIS polygon, one owner -> many).
create table if not exists public.properties (
  id          uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  -- PostGIS polygon in WGS84. App sends GeoJSON Polygon -> ST_SetSRID(ST_GeomFromGeoJSON(...),4326)
  geometry    geometry(Polygon, 4326) not null,
  created_at  timestamptz not null default now()
);

create index if not exists properties_owner_idx on public.properties (owner_user_id);
create index if not exists properties_geometry_idx on public.properties using gist (geometry);

-- RLS for properties
alter table public.properties enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.properties to anon, authenticated;
grant insert, update, delete on public.properties to authenticated;

-- Anyone (incl. anon) can read claimed plots — they render on the public map.
drop policy if exists "properties_select_public" on public.properties;
create policy "properties_select_public"
  on public.properties for select
  using (true);

-- Only the owner can create/update/delete their own plots.
drop policy if exists "properties_insert_owner" on public.properties;
create policy "properties_insert_owner"
  on public.properties for insert
  with check (auth.uid() = owner_user_id);

drop policy if exists "properties_update_owner" on public.properties;
create policy "properties_update_owner"
  on public.properties for update
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

drop policy if exists "properties_delete_owner" on public.properties;
create policy "properties_delete_owner"
  on public.properties for delete
  using (auth.uid() = owner_user_id);

-- 3) Helper: which property (if any) contains a given point.
--    Returns the property id + owner so the app can prioritise notifications.
create or replace function public.property_for_point(
  p_lng double precision,
  p_lat double precision
)
returns table (property_id uuid, owner_user_id uuid)
language sql
stable
as $$
  select pr.id, pr.owner_user_id
  from public.properties pr
  where st_contains(
    pr.geometry,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)
  )
  limit 1;
$$;
