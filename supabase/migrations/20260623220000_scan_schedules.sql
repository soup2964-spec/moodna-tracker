create table scan_schedules (
  id uuid primary key default gen_random_uuid(),
  brand_profile_id uuid not null references brand_profiles(id) on delete cascade,
  enabled boolean not null default true,
  frequency text not null default 'twice_daily'
    check (frequency in ('once', 'daily', 'twice_daily', 'weekly')),
  am_marketplaces marketplace[] not null default '{}',
  pm_marketplaces marketplace[] not null default '{}',
  keywords text[] not null default '{}',
  risk_threshold integer not null default 75 check (risk_threshold between 1 and 100),
  timezone text not null default 'UTC',
  am_run_at time not null default '09:00',
  pm_run_at time not null default '21:00',
  stagger_minutes integer not null default 0 check (stagger_minutes between 0 and 59),
  last_am_run_at timestamptz,
  last_pm_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_profile_id)
);

alter table scan_jobs
  add column if not exists schedule_id uuid references scan_schedules(id) on delete set null,
  add column if not exists run_slot text check (run_slot in ('am', 'pm', 'manual'));

alter table scan_jobs drop constraint if exists scan_jobs_frequency_check;
alter table scan_jobs add constraint scan_jobs_frequency_check
  check (frequency in ('once', 'daily', 'twice_daily', 'weekly'));

alter table scan_schedules enable row level security;

create policy "members can manage scan schedules"
on scan_schedules for all
using (
  exists (
    select 1 from brand_profiles
    where brand_profiles.id = scan_schedules.brand_profile_id
      and is_org_member(brand_profiles.organization_id)
  )
)
with check (
  exists (
    select 1 from brand_profiles
    where brand_profiles.id = scan_schedules.brand_profile_id
      and is_org_member(brand_profiles.organization_id)
  )
);

create index scan_schedules_enabled_idx on scan_schedules (enabled) where enabled = true;
