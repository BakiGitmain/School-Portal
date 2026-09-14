-- Check every local day because timetable active days are configurable; the
-- reminder function exits without inserting when no homeroom lesson is due.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'attendance-reminders-v1' limit 1;
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'attendance-reminders-v1',
    '*/15 3-15 * * *',
    'select public.create_attendance_reminders_v1();'
  );
end;
$$;
