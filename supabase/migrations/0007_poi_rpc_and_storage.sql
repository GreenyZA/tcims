-- TCIMS — Fix POI flagging + photo upload for community (anonymous) pins.
-- Root cause: incidents are created anonymously (user_id IS NULL), so the
-- incidents UPDATE policy (auth.uid() = user_id) rejects every UPDATE. That
-- blocks toggling is_poi. Photos worked around this via the security-definer
-- append_incident_photo RPC; we apply the same pattern to POI, and relax the
-- storage upload policy to match anonymous incident creation.
-- Safe to re-run: CREATE OR REPLACE / idempotent UPDATE / IF NOT EXISTS.

-- 1) POI toggle as a SECURITY DEFINER RPC (bypasses RLS, like append_incident_photo).
--    This lets any authenticated OR anonymous reporter mark a pin as a POI.
create or replace function public.set_incident_poi(p_id uuid, p_is_poi boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.incidents
     set is_poi = p_is_poi
   where id = p_id;
end;
$$;

grant execute on function public.set_incident_poi(uuid, boolean) to anon, authenticated;

-- 2) Storage upload policy: allow anonymous reporters to upload too.
--    The incident map already permits anonymous incident creation, so photo
--    upload must match. (Read remains public via photos_select_public.)
drop policy if exists "photos_insert_auth" on storage.objects;
create policy "photos_insert_auth"
  on storage.objects for insert
  with check (bucket_id = 'incident-photos');

-- 3) Guarantee the photo bucket is actually public so thumbnails render.
update storage.buckets
   set public = true
 where id = 'incident-photos';

-- 4) The "reported" trigger also does a real UPDATE on incidents, which RLS
--    (auth.uid() = user_id) blocks for anonymous pins. Make it SECURITY DEFINER
--    so it can set is_reported regardless of the pin's owner. (Idempotent:
--    CREATE OR REPLACE + re-attach trigger.)
create or replace function public.incidents_set_reported()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.incidents
     set is_reported = true
   where id = new.incident_id;
  return new;
end;
$$;

drop trigger if exists incidents_reported_on_insert on public.incident_reports;
create trigger incidents_reported_on_insert
  after insert on public.incident_reports
  for each row
  execute function public.incidents_set_reported();
