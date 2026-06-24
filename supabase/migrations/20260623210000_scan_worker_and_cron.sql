alter table scan_jobs
  add column if not exists error_message text;
