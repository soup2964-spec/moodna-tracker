create extension if not exists "pgcrypto";

create type marketplace as enum (
  'amazon',
  'walmart',
  'ebay',
  'etsy',
  'aliexpress',
  'shopify',
  'reddit',
  'telegram',
  'twitter',
  'discord',
  'kemono',
  'bunkr',
  'simpcity',
  'thothub'
);
create type claim_type as enum ('copyright', 'trademark', 'counterfeit');
create type scan_job_status as enum ('queued', 'running', 'completed', 'failed');
create type scan_result_status as enum ('new', 'reviewing', 'approved', 'rejected', 'takedown_requested', 'removed');
create type alert_status as enum ('unread', 'read', 'actioned');
create type takedown_status as enum ('draft', 'awaiting_owner_approval', 'approved', 'submitted', 'removed', 'rejected');

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  clerk_org_id text unique,
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  clerk_user_id text not null,
  role text not null default 'owner' check (role in ('owner', 'admin', 'reviewer', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, clerk_user_id)
);

create table brand_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  website_url text not null,
  brand_name text not null,
  owner_name text not null,
  owner_email text not null,
  authorized_agent text not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ip_assets (
  id uuid primary key default gen_random_uuid(),
  brand_profile_id uuid not null references brand_profiles(id) on delete cascade,
  type text not null check (type in ('website', 'logo', 'product_url', 'product_image', 'copyright_text', 'trademark')),
  value text not null,
  source_url text,
  storage_path text,
  created_at timestamptz not null default now()
);

create table scan_jobs (
  id uuid primary key default gen_random_uuid(),
  brand_profile_id uuid not null references brand_profiles(id) on delete cascade,
  marketplaces marketplace[] not null,
  keywords text[] not null default '{}',
  status scan_job_status not null default 'queued',
  frequency text not null default 'once' check (frequency in ('once', 'daily', 'weekly')),
  risk_threshold integer not null default 75 check (risk_threshold between 1 and 100),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table scan_results (
  id uuid primary key default gen_random_uuid(),
  scan_job_id uuid not null references scan_jobs(id) on delete cascade,
  brand_profile_id uuid not null references brand_profiles(id) on delete cascade,
  marketplace marketplace not null,
  seller_name text not null,
  listing_title text not null,
  listing_url text not null,
  confidence integer not null check (confidence between 0 and 100),
  match_reason text not null,
  status scan_result_status not null default 'new',
  evidence_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table review_decisions (
  id uuid primary key default gen_random_uuid(),
  scan_result_id uuid not null references scan_results(id) on delete cascade,
  reviewer_member_id uuid references members(id) on delete set null,
  decision scan_result_status not null check (decision in ('approved', 'rejected', 'reviewing')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  scan_result_id uuid not null references scan_results(id) on delete cascade,
  brand_profile_id uuid not null references brand_profiles(id) on delete cascade,
  title text not null,
  message text not null,
  status alert_status not null default 'unread',
  created_at timestamptz not null default now()
);

create table takedown_requests (
  id uuid primary key default gen_random_uuid(),
  scan_result_id uuid not null references scan_results(id) on delete cascade,
  brand_profile_id uuid not null references brand_profiles(id) on delete cascade,
  claim_type claim_type not null default 'copyright',
  status takedown_status not null default 'draft',
  owner_attestation boolean not null default false,
  dmca_statement text not null,
  submitted_to marketplace,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create table dmca_submissions (
  id uuid primary key default gen_random_uuid(),
  takedown_request_id uuid not null references takedown_requests(id) on delete cascade,
  marketplace marketplace not null,
  submission_payload jsonb not null,
  response_payload jsonb,
  external_case_id text,
  status takedown_status not null default 'submitted',
  created_at timestamptz not null default now()
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  actor_member_id uuid references members(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table organizations enable row level security;
alter table members enable row level security;
alter table brand_profiles enable row level security;
alter table ip_assets enable row level security;
alter table scan_jobs enable row level security;
alter table scan_results enable row level security;
alter table review_decisions enable row level security;
alter table alerts enable row level security;
alter table takedown_requests enable row level security;
alter table dmca_submissions enable row level security;
alter table audit_events enable row level security;

create or replace function current_clerk_user_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')
$$;

create or replace function is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from members
    where members.organization_id = org_id
      and members.clerk_user_id = current_clerk_user_id()
  )
$$;

create policy "members can read their organizations"
on organizations for select
using (is_org_member(id));

create policy "members can read org members"
on members for select
using (is_org_member(organization_id));

create policy "members can manage brand profiles"
on brand_profiles for all
using (is_org_member(organization_id))
with check (is_org_member(organization_id));

create policy "members can manage ip assets"
on ip_assets for all
using (
  exists (
    select 1 from brand_profiles
    where brand_profiles.id = ip_assets.brand_profile_id
      and is_org_member(brand_profiles.organization_id)
  )
)
with check (
  exists (
    select 1 from brand_profiles
    where brand_profiles.id = ip_assets.brand_profile_id
      and is_org_member(brand_profiles.organization_id)
  )
);

create policy "members can manage scan jobs"
on scan_jobs for all
using (
  exists (
    select 1 from brand_profiles
    where brand_profiles.id = scan_jobs.brand_profile_id
      and is_org_member(brand_profiles.organization_id)
  )
)
with check (
  exists (
    select 1 from brand_profiles
    where brand_profiles.id = scan_jobs.brand_profile_id
      and is_org_member(brand_profiles.organization_id)
  )
);

create policy "members can manage scan results"
on scan_results for all
using (
  exists (
    select 1 from brand_profiles
    where brand_profiles.id = scan_results.brand_profile_id
      and is_org_member(brand_profiles.organization_id)
  )
)
with check (
  exists (
    select 1 from brand_profiles
    where brand_profiles.id = scan_results.brand_profile_id
      and is_org_member(brand_profiles.organization_id)
  )
);

create policy "members can manage review decisions"
on review_decisions for all
using (
  exists (
    select 1
    from scan_results
    join brand_profiles on brand_profiles.id = scan_results.brand_profile_id
    where scan_results.id = review_decisions.scan_result_id
      and is_org_member(brand_profiles.organization_id)
  )
)
with check (
  exists (
    select 1
    from scan_results
    join brand_profiles on brand_profiles.id = scan_results.brand_profile_id
    where scan_results.id = review_decisions.scan_result_id
      and is_org_member(brand_profiles.organization_id)
  )
);

create policy "members can manage alerts"
on alerts for all
using (
  exists (
    select 1 from brand_profiles
    where brand_profiles.id = alerts.brand_profile_id
      and is_org_member(brand_profiles.organization_id)
  )
)
with check (
  exists (
    select 1 from brand_profiles
    where brand_profiles.id = alerts.brand_profile_id
      and is_org_member(brand_profiles.organization_id)
  )
);

create policy "members can manage takedown requests"
on takedown_requests for all
using (
  exists (
    select 1 from brand_profiles
    where brand_profiles.id = takedown_requests.brand_profile_id
      and is_org_member(brand_profiles.organization_id)
  )
)
with check (
  exists (
    select 1 from brand_profiles
    where brand_profiles.id = takedown_requests.brand_profile_id
      and is_org_member(brand_profiles.organization_id)
  )
);

create policy "members can manage dmca submissions"
on dmca_submissions for all
using (
  exists (
    select 1
    from takedown_requests
    join brand_profiles on brand_profiles.id = takedown_requests.brand_profile_id
    where takedown_requests.id = dmca_submissions.takedown_request_id
      and is_org_member(brand_profiles.organization_id)
  )
)
with check (
  exists (
    select 1
    from takedown_requests
    join brand_profiles on brand_profiles.id = takedown_requests.brand_profile_id
    where takedown_requests.id = dmca_submissions.takedown_request_id
      and is_org_member(brand_profiles.organization_id)
  )
);

create policy "members can read audit events"
on audit_events for select
using (is_org_member(organization_id));

insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;
