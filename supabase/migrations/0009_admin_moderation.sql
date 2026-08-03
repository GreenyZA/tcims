-- TCIMS — Admin moderation: admin role on profiles + admin access to reports/incidents.
-- Depends on 0001–0008. Safe to re-run: IF NOT EXISTS / DROP POLICY IF EXISTS / CREATE OR REPLACE.

-- 1) Admin flag on profiles (for now, the owner can manually set is_admin = true
--    via Supabase Studio; a future role-management UI may toggle it).
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create index if not exists profiles_admin_idx on public.profiles (is_admin)
  where is_admin;

-- 2) Admins can read ALL incident_reports (current policy only lets reporters
--    see their own reports).
drop policy if exists "reports_select_admin" on public.incident_reports;
create policy "reports_select_admin"
  on public.incident_reports for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    ) or auth.uid() = reporter_id
  );

-- 3) Admins can update any report (status, etc.).
drop policy if exists "reports_update_admin" on public.incident_reports;
create policy "reports_update_admin"
  on public.incident_reports for update
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

-- 4) Admins can delete ANY incident (not just their own).
--    The existing delete policy only allows the owner.
drop policy if exists "incidents_delete_admin" on public.incidents;
create policy "incidents_delete_admin"
  on public.incidents for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );

-- 5) Grant admin delete on reports too (so an admin can dismiss/remove reports).
drop policy if exists "reports_delete_admin" on public.incident_reports;
create policy "reports_delete_admin"
  on public.incident_reports for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );
