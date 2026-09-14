begin;

do $test$
declare
  v_admin_id uuid;
  v_daniel_id uuid;
  v_student_10a_id uuid;
  v_class_10a_id uuid;
  v_test_class_10b_id uuid := gen_random_uuid();
  v_settings_id uuid;
  v_version_id uuid;
  v_collision_version_id uuid;
  v_result jsonb;
  v_payload jsonb;
  v_start integer;
  v_end integer;
  v_collision_rejected boolean := false;
  v_config jsonb := jsonb_build_object(
    'active_days', jsonb_build_array(1, 2, 3, 4, 5),
    'start_minute', 600,
    'periods_per_day', 7,
    'period_minutes', 45,
    'time_display', '12h',
    'breaks', jsonb_build_array(
      jsonb_build_object('kind', 'rest', 'label', 'Rest', 'after_period', 3, 'duration_minutes', 20),
      jsonb_build_object('kind', 'lunch', 'label', 'Lunch', 'after_period', 5, 'duration_minutes', 45)
    )
  );
begin
  select user_id into v_admin_id
  from public.profiles
  where role = 'admin' and not must_change_password
  order by created_at
  limit 1;

  select user_id into v_daniel_id
  from public.profiles
  where role = 'teacher' and lower(btrim(full_name)) = 'daniel'
  order by created_at
  limit 1;

  select id into v_class_10a_id
  from public.school_classes
  where class_name = '10A'
  limit 1;

  select user_id into v_student_10a_id
  from public.profiles
  where role = 'student' and class_id = v_class_10a_id and not must_change_password
  order by created_at
  limit 1;

  select id into v_settings_id
  from public.timetable_settings
  order by created_at
  limit 1;

  if v_admin_id is null or v_daniel_id is null or v_student_10a_id is null
    or v_class_10a_id is null or v_settings_id is null then
    raise exception 'Manual timetable test prerequisites are missing.';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);

  insert into public.timetable_versions (
    settings_id, title, source_type, status, created_by, generator_score, config_snapshot
  ) values (
    v_settings_id, 'Manual Schedule', 'manual', 'draft', v_admin_id, null, v_config
  ) returning id into v_version_id;

  -- A single manual English lesson intentionally does not match the old
  -- timetable_requirements weekly count. Times are intentionally stale.
  insert into public.timetable_entries (
    version_id, requirement_id, teacher_user_id, class_id, subject,
    day_of_week, period_index, start_minute, end_minute
  ) values (
    v_version_id, null, v_daniel_id, v_class_10a_id, 'English',
    1, 1, 495, 540
  );

  v_result := public.publish_manual_timetable(v_version_id);
  if not coalesce((v_result->>'success')::boolean, false) then
    raise exception 'Manual publish did not report success.';
  end if;

  select start_minute, end_minute
  into v_start, v_end
  from public.timetable_entries
  where version_id = v_version_id;

  if v_start <> 600 or v_end <> 645 then
    raise exception 'Stale lesson times were not synchronized from period_index.';
  end if;

  perform set_config('request.jwt.claim.sub', v_daniel_id::text, true);
  v_payload := public.my_published_timetable_v1();
  if jsonb_array_length(v_payload->'entries') <> 1
    or v_payload->'entries'->0->>'teacher_user_id' <> v_daniel_id::text then
    raise exception 'Teacher published schedule scope failed.';
  end if;

  perform set_config('request.jwt.claim.sub', v_student_10a_id::text, true);
  v_payload := public.my_published_timetable_v1();
  if jsonb_array_length(v_payload->'entries') <> 1
    or v_payload->'entries'->0->>'class_id' <> v_class_10a_id::text then
    raise exception 'Student published class schedule scope failed.';
  end if;

  -- The live project has no 10B, so create it only inside this transaction to
  -- exercise the exact Daniel/10A/10B Monday P1 collision without persisting it.
  insert into public.school_classes (
    id, category, grade_label, section, class_name, created_by, subjects
  )
  select v_test_class_10b_id, category, grade_label, 'B', '10B', v_admin_id, subjects
  from public.school_classes
  where id = v_class_10a_id;

  insert into public.teacher_class_assignments (
    teacher_user_id, class_id, created_by, subjects
  ) values (
    v_daniel_id, v_test_class_10b_id, v_admin_id, array['English']::text[]
  );

  insert into public.timetable_versions (
    settings_id, title, source_type, status, created_by, generator_score, config_snapshot
  ) values (
    v_settings_id, 'Manual Schedule', 'manual', 'draft', v_admin_id, null, v_config
  ) returning id into v_collision_version_id;

  insert into public.timetable_entries (
    version_id, requirement_id, teacher_user_id, class_id, subject,
    day_of_week, period_index, start_minute, end_minute
  ) values (
    v_collision_version_id, null, v_daniel_id, v_class_10a_id, 'English',
    1, 1, 600, 645
  );

  begin
    insert into public.timetable_entries (
      version_id, requirement_id, teacher_user_id, class_id, subject,
      day_of_week, period_index, start_minute, end_minute
    ) values (
      v_collision_version_id, null, v_daniel_id, v_test_class_10b_id, 'English',
      1, 1, 600, 645
    );
  exception when unique_violation then
    v_collision_rejected := true;
  end;

  if not v_collision_rejected then
    raise exception 'The database accepted a teacher collision.';
  end if;

  raise notice 'manual timetable rollback test passed';
end
$test$;

rollback;
