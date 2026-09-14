begin;

-- Generated and manually-authored drafts follow different validation rules.
-- Existing manual drafts can be identified safely: the current manual builder
-- uses this title, never sets generator metadata/score, and never links entries
-- to timetable requirements.
alter table public.timetable_versions
  add column if not exists source_type text;

update public.timetable_versions v
set source_type = 'manual'
where v.source_type is null
  and v.title = 'Manual Schedule'
  and v.generator_score is null
  and v.generation_request_id is null
  and v.generation_metadata is null
  and not exists (
    select 1
    from public.timetable_entries e
    where e.version_id = v.id
      and e.requirement_id is not null
  );

update public.timetable_versions
set source_type = 'generated'
where source_type is null;

alter table public.timetable_versions
  alter column source_type set default 'generated',
  alter column source_type set not null;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.timetable_versions'::regclass
      and conname = 'timetable_versions_source_type_check'
  ) then
    alter table public.timetable_versions
      add constraint timetable_versions_source_type_check
      check (source_type in ('manual', 'generated'));
  end if;
end
$migration$;

create or replace function public.publish_manual_timetable(p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_version public.timetable_versions%rowtype;
  v_config jsonb;
  v_breaks jsonb;
  v_start_minute integer;
  v_period_minutes integer;
  v_periods_per_day integer;
  v_day_end_minute integer;
  v_entry_count integer;
  v_published_at timestamptz := now();
begin
  perform public.timetable_require_admin_v1();
  perform pg_advisory_xact_lock(77319011);

  select *
  into v_version
  from public.timetable_versions
  where id = p_version_id
  for update;

  if not found then
    raise exception 'The manual timetable draft does not exist.';
  end if;
  if v_version.source_type <> 'manual' then
    raise exception 'Only manual timetable drafts can use this publish action.' using errcode = '42501';
  end if;
  if v_version.status <> 'draft' then
    raise exception 'The manual timetable version is not a draft.';
  end if;

  v_config := v_version.config_snapshot;
  v_breaks := v_config->'breaks';

  if jsonb_typeof(v_config) is distinct from 'object'
    or jsonb_typeof(v_config->'active_days') is distinct from 'array'
    or jsonb_typeof(v_breaks) is distinct from 'array'
    or jsonb_array_length(v_config->'active_days') not between 1 and 7
    or jsonb_array_length(v_breaks) > 20 then
    raise exception 'The manual timetable configuration is invalid.';
  end if;

  begin
    v_start_minute := (v_config->>'start_minute')::integer;
    v_period_minutes := (v_config->>'period_minutes')::integer;
    v_periods_per_day := (v_config->>'periods_per_day')::integer;
  exception when others then
    raise exception 'The manual timetable configuration is invalid.';
  end;

  if v_start_minute not between 0 and 1439
    or v_period_minutes not between 10 and 180
    or v_periods_per_day not between 1 and 20 then
    raise exception 'The manual timetable configuration is invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_config->'active_days') d(value)
    where value::integer not between 1 and 7
  ) or (
    select count(*) <> count(distinct value::integer)
    from jsonb_array_elements_text(v_config->'active_days') d(value)
  ) then
    raise exception 'The active school days are invalid.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_breaks) b(value)
    where jsonb_typeof(value) is distinct from 'object'
      or (value->>'after_period')::integer not between 1 and v_periods_per_day - 1
      or (value->>'duration_minutes')::integer not between 1 and 180
  ) or (
    select count(*) <> count(distinct (value->>'after_period')::integer)
    from jsonb_array_elements(v_breaks) b(value)
  ) then
    raise exception 'The timetable breaks are invalid.';
  end if;

  select v_start_minute
       + (v_periods_per_day * v_period_minutes)
       + coalesce(sum((b.value->>'duration_minutes')::integer), 0)
  into v_day_end_minute
  from jsonb_array_elements(v_breaks) b(value);

  if v_day_end_minute > 1440 then
    raise exception 'The school day runs past midnight.';
  end if;

  select count(*)
  into v_entry_count
  from public.timetable_entries
  where version_id = p_version_id;

  if v_entry_count not between 1 and 10000 then
    raise exception 'The manual timetable must contain at least one lesson.';
  end if;

  if exists (
    select 1
    from public.timetable_entries e
    where e.version_id = p_version_id
      and e.requirement_id is not null
  ) then
    raise exception 'A manual lesson cannot reference a generated timetable requirement.';
  end if;

  if exists (
    select 1
    from public.timetable_entries e
    where e.version_id = p_version_id
      and (
        not exists (select 1 from public.school_classes c where c.id = e.class_id)
        or not exists (
          select 1
          from public.profiles t
          where t.user_id = e.teacher_user_id
            and t.role = 'teacher'
        )
      )
  ) then
    raise exception 'A manual lesson references a class or teacher that no longer exists.';
  end if;

  if exists (
    select 1
    from public.timetable_entries e
    where e.version_id = p_version_id
      and (
        btrim(e.subject) = ''
        or not exists (
          select 1
          from public.teacher_class_assignments a
          cross join lateral unnest(a.subjects) assigned_subject(subject)
          where a.teacher_user_id = e.teacher_user_id
            and a.class_id = e.class_id
            and lower(btrim(assigned_subject.subject)) = lower(btrim(e.subject))
        )
      )
  ) then
    raise exception 'A manual lesson does not match the teacher, class, and subject assignment.';
  end if;

  if exists (
    select 1
    from public.timetable_entries e
    where e.version_id = p_version_id
      and (
        e.period_index not between 1 and v_periods_per_day
        or not exists (
          select 1
          from jsonb_array_elements_text(v_config->'active_days') d(value)
          where value::integer = e.day_of_week
        )
      )
  ) then
    raise exception 'A manual lesson is outside the active school days or configured periods.';
  end if;

  if exists (
    select 1
    from public.timetable_entries e
    where e.version_id = p_version_id
    group by e.class_id, e.day_of_week, e.period_index
    having count(*) > 1
  ) then
    raise exception 'A class has two lessons in the same period.';
  end if;

  if exists (
    select 1
    from public.timetable_entries e
    where e.version_id = p_version_id
    group by e.teacher_user_id, e.day_of_week, e.period_index
    having count(*) > 1
  ) then
    raise exception 'A teacher has two lessons in the same period.';
  end if;

  -- period_index is authoritative. Stale stored times are repaired before the
  -- version is published, using the same snapshot consumed by schedule readers.
  update public.timetable_entries e
  set start_minute = v_start_minute
      + ((e.period_index - 1) * v_period_minutes)
      + coalesce((
          select sum((b.value->>'duration_minutes')::integer)
          from jsonb_array_elements(v_breaks) b(value)
          where (b.value->>'after_period')::integer < e.period_index
        ), 0),
      end_minute = v_start_minute
      + (e.period_index * v_period_minutes)
      + coalesce((
          select sum((b.value->>'duration_minutes')::integer)
          from jsonb_array_elements(v_breaks) b(value)
          where (b.value->>'after_period')::integer < e.period_index
        ), 0)
  where e.version_id = p_version_id;

  if exists (
    select 1
    from public.timetable_entries e
    where e.version_id = p_version_id
      and (
        e.start_minute <> v_start_minute
          + ((e.period_index - 1) * v_period_minutes)
          + coalesce((
              select sum((b.value->>'duration_minutes')::integer)
              from jsonb_array_elements(v_breaks) b(value)
              where (b.value->>'after_period')::integer < e.period_index
            ), 0)
        or e.end_minute <> e.start_minute + v_period_minutes
      )
  ) then
    raise exception 'The manual lesson times could not be synchronized.';
  end if;

  -- Keep the existing one-published-version invariant and remove stale manual
  -- drafts from future builder loads. Generated drafts remain untouched/read-only.
  update public.timetable_versions
  set status = 'archived'
  where status = 'published'
    and id <> p_version_id;

  update public.timetable_versions
  set status = 'archived'
  where source_type = 'manual'
    and status = 'draft'
    and id <> p_version_id;

  update public.timetable_versions
  set status = 'published',
      published_at = v_published_at
  where id = p_version_id;

  return jsonb_build_object(
    'success', true,
    'version_id', p_version_id,
    'entry_count', v_entry_count,
    'published_at', v_published_at
  );
end;
$function$;

revoke all on function public.publish_manual_timetable(uuid) from public;
revoke all on function public.publish_manual_timetable(uuid) from anon;
grant execute on function public.publish_manual_timetable(uuid) to authenticated;

comment on function public.publish_manual_timetable(uuid) is
  'Admin-only atomic publish path for manual timetable drafts. Validates assignments and collisions, resynchronizes lesson times from period_index, archives the previous publication, and does not enforce timetable requirement counts.';

commit;
