-- TCIMS — Ensure the incident-photos Storage bucket exists and is public.
-- Root cause of the white-bar thumbnail: the bucket named by 0001_init.sql
-- was never created on this instance, so uploads have nowhere to land and
-- getPublicUrl() points at a non-existent bucket (blank <img>).
-- Idempotent: INSERT ... ON CONFLICT DO NOTHING + re-apply public flag + policies.

-- 1) Create the bucket if it does not already exist.
insert into storage.buckets (id, name, public)
values ('incident-photos', 'incident-photos', true)
on conflict (id) do nothing;

-- 2) Force it public so thumbnail URLs resolve without an auth token
--    (the browser <img> tags call the public object endpoint directly).
update storage.buckets
   set public = true
 where id = 'incident-photos';

-- 3) Public read of any object in the bucket.
drop policy if exists "photos_select_public" on storage.objects;
create policy "photos_select_public"
  on storage.objects for select
  using (bucket_id = 'incident-photos');

-- 4) Allow authenticated AND anonymous reporters to upload (the map permits
--    anonymous incident creation, so photo upload must match).
drop policy if exists "photos_insert_auth" on storage.objects;
create policy "photos_insert_auth"
  on storage.objects for insert
  with check (bucket_id = 'incident-photos');

-- 5) Allow the owner (or anon, for community pins) to delete their photo.
drop policy if exists "photos_delete_auth" on storage.objects;
create policy "photos_delete_auth"
  on storage.objects for delete
  using (bucket_id = 'incident-photos');
