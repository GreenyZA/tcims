-- TCIMS — "Reported for removal" flag on incidents.
-- Depends on 0004_comments_poi_reports.sql (incident_reports table).
-- Mirrors the is_priority trigger pattern from 0003: a pin is flagged the
-- moment anyone files a removal report, regardless of how the report is made.
-- Safe to re-run: IF NOT EXISTS / CREATE OR REPLACE.

-- 1) Flag column on incidents.
alter table public.incidents
  add column if not exists is_reported boolean not null default false;

create index if not exists incidents_reported_idx
  on public.incidents (is_reported);

-- 2) Trigger function: set is_reported = true when a report appears for the pin.
create or replace function public.incidents_set_reported()
returns trigger
language plpgsql
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

-- 3) Seed the flag for any reports that already exist (re-run safe).
update public.incidents i
   set is_reported = true
 where exists (
   select 1 from public.incident_reports r where r.incident_id = i.id
 );
