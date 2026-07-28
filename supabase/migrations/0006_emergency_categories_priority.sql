-- TCIMS — Emergency categories are always TOP priority.
-- Adds three emergency incident types and forces is_priority = true for them
-- in the incidents_priority_trigger (regardless of location), so a service
-- (Fire / EMS / SAPS) can later be notified via Telegram.
-- Depends on 0003 (is_priority column + set_incident_priority()).
-- Safe to re-run: CREATE OR REPLACE / idempotent UPDATE.

-- 1) Emergency category ids that always get TOP priority.
do $$
declare
  v_types text[] := array['fire', 'health_emergency', 'police_required'];
begin
  -- No dedicated category table: we document the set via the trigger below.
  -- (Categories live client-side in lib/categories.ts; the DB only needs the
  --  `type` string values to recognise emergencies.)
  perform 1;
end $$;

-- 2) Extend the existing priority trigger so emergency types are priority
--    even when they fall outside any claimed property.
create or replace function public.set_incident_priority()
returns trigger
language plpgsql
as $$
declare
  hit record;
  v_emergency_types text[] := array['fire', 'health_emergency', 'police_required'];
begin
  -- Emergency categories are TOP priority no matter where they are.
  if new.type = any(v_emergency_types) then
    new.is_priority := true;
    -- Keep any property containment link if present, but don't lose priority.
    if new.location is not null then
      select property_id, owner_user_id
        into hit
        from public.property_for_point(st_x(new.location), st_y(new.location));
      if hit.property_id is not null then
        new.property_id := hit.property_id;
      end if;
    end if;
    return new;
  end if;

  -- Otherwise: priority = inside a claimed property polygon (existing logic).
  if new.location is null then
    new.is_priority := false;
    new.property_id := null;
    return new;
  end if;

  select property_id, owner_user_id
    into hit
    from public.property_for_point(st_x(new.location), st_y(new.location));

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
  before insert or update of location, type
  on public.incidents
  for each row
  execute function public.set_incident_priority();

-- 3) Backfill: any existing emergency-type incident becomes priority.
update public.incidents
   set is_priority = true
 where type = any(array['fire', 'health_emergency', 'police_required']);
