-- Paste into Supabase Studio (http://192.168.1.10:54323) → SQL Editor, run it.
-- Then reload PostgREST schema cache (Settings → API → Reload schema)
-- or run:  NOTIFY pgrst, 'reload schema';

-- TCIMS — Incident priority flag for land-owner property containment.
alter table public.incidents
  add column if not exists is_priority boolean not null default false;

alter table public.incidents
  add column if not exists property_id uuid
    references public.properties(id) on delete set null;

create index if not exists incidents_priority_idx
  on public.incidents (is_priority);

create or replace function public.set_incident_priority()
returns trigger
language plpgsql
as $$
declare
  hit record;
begin
  if new.location is null then
    new.is_priority := false;
    new.property_id := null;
    return new;
  end if;

  select property_id, owner_user_id
    into hit
  from public.property_for_point(
    st_x(new.location),
    st_y(new.location)
  );

  if hit.property_id is not null then
    new.is_priority  := true;
    new.property_id := hit.property_id;
  else
    new.is_priority  := false;
    new.property_id  := null;
  end if;

  return new;
end;
$$;

drop trigger if exists incidents_priority_trigger on public.incidents;
create trigger incidents_priority_trigger
  before insert or update of location
  on public.incidents
  for each row
  execute function public.set_incident_priority();

-- Backfill existing incidents already inside a claimed polygon.
-- NOTE: UPDATE ... FROM cannot reference the target table, so use a
-- correlated subquery (allowed in SET / WHERE) instead.
update public.incidents i
set is_priority = true,
    property_id = (
      select p.property_id
      from public.property_for_point(st_x(i.location), st_y(i.location)) p
      limit 1
    )
where i.location is not null
  and exists (
    select 1
    from public.property_for_point(st_x(i.location), st_y(i.location)) pp
    where pp.property_id is not null
  );
