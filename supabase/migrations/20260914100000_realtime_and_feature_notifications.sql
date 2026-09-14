-- Realtime publication plus low-noise notifications for actual publication events.
-- Existing notification RLS remains authoritative for Postgres Changes delivery.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_notifications'
  ) then
    alter publication supabase_realtime add table public.app_notifications;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notification_reads'
  ) then
    alter publication supabase_realtime add table public.notification_reads;
  end if;
end;
$$;

create or replace function public.notify_published_timetable_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    -- A teacher is affected only when the published version contains one of
    -- their lessons. One row per teacher keeps push targeting private.
    insert into public.app_notifications (
      kind, title, message, audience_type, target_user_id,
      sender_user_id, source_type, source_key, action_type, visible_from
    )
    select
      'info',
      'Schedule updated',
      'A new teaching schedule has been published.',
      'user',
      teachers.teacher_user_id,
      new.created_by,
      'timetable',
      'published:' || new.id::text || ':teacher:' || teachers.teacher_user_id::text,
      'schedule',
      now()
    from (
      select distinct e.teacher_user_id
      from public.timetable_entries e
      where e.version_id = new.id
    ) teachers
    on conflict (source_type, source_key) do nothing;

    -- Students are targeted by affected class, avoiding notifications for
    -- classes absent from this publication without generating one row per pupil.
    insert into public.app_notifications (
      kind, title, message, audience_type, target_class_id,
      sender_user_id, source_type, source_key, action_type, visible_from
    )
    select
      'info',
      'Schedule updated',
      'A new class schedule has been published.',
      'class',
      classes.class_id,
      new.created_by,
      'timetable',
      'published:' || new.id::text || ':class:' || classes.class_id::text,
      'schedule',
      now()
    from (
      select distinct e.class_id
      from public.timetable_entries e
      where e.version_id = new.id
    ) classes
    on conflict (source_type, source_key) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.notify_result_publication_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage_label text;
begin
  if new.published and (tg_op = 'INSERT' or old.published is distinct from true) then
    v_stage_label := case new.stage
      when 'test' then 'Test results'
      when 'mid' then 'Midterm results'
      when 'final_exam' then 'Final exam results'
      when 'total' then 'Semester results'
      when 'final_result' then 'Final results'
      else 'Results'
    end;

    insert into public.app_notifications (
      kind, title, message, audience_type, target_user_id,
      sender_user_id, source_type, source_key, action_type, visible_from
    )
    select
      'test',
      v_stage_label || ' published',
      'Your ' || lower(v_stage_label) || ' are now available.',
      'user',
      students.student_user_id,
      new.published_by,
      'result_publication',
      new.id::text || ':' || students.student_user_id::text,
      'results',
      now()
    from (
      select distinct e.student_user_id
      from public.mark_sheet_entries e
      join public.mark_sheets s on s.id = e.mark_sheet_id
      where s.school_year = new.school_year
        and (new.semester = 0 or s.semester = new.semester)
        and case new.stage
          when 'test' then e.test_raw_score is not null
          when 'mid' then e.mid_raw_score is not null
          when 'final_exam' then e.final_exam_raw_score is not null
          when 'total' then e.total_score is not null
          when 'final_result' then e.total_score is not null
          else false
        end
    ) students
    join public.profiles p
      on p.user_id = students.student_user_id
      and p.role = 'student'
      and coalesce(p.must_change_password, false) = false
    on conflict (source_type, source_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists result_publications_notify_published on public.result_publications;
create trigger result_publications_notify_published
  after insert or update of published on public.result_publications
  for each row execute function public.notify_result_publication_v1();

revoke all on function public.notify_published_timetable_v1() from public, anon, authenticated;
revoke all on function public.notify_result_publication_v1() from public, anon, authenticated;
