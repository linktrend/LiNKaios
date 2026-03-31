-- AIOS LiNKbrain bootstrap
-- Applies to Supabase project: LiNKtrend AIOS

create extension if not exists vector;
create extension if not exists pgcrypto;

create schema if not exists lb_core;
create schema if not exists lb_shared;
create schema if not exists lb_scratch;

create or replace function lb_core.current_tenant()
returns uuid
language plpgsql
stable
as $$
declare
  tenant_text text;
begin
  tenant_text := current_setting('app.current_tenant', true);
  if tenant_text is null or length(trim(tenant_text)) = 0 then
    raise exception 'app.current_tenant is required';
  end if;
  return tenant_text::uuid;
exception
  when invalid_text_representation then
    raise exception 'app.current_tenant must be a valid UUID';
end;
$$;

create or replace function lb_core.set_tenant_context(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = lb_core, public
as $$
begin
  perform set_config('app.current_tenant', p_tenant::text, true);
end;
$$;

create table if not exists lb_core.tenants (
  id uuid primary key default gen_random_uuid(),
  venture_name text not null unique,
  slug text not null unique,
  status text not null check (status in ('active', 'paused', 'handover_pending', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into lb_core.tenants (id, venture_name, slug, status)
values (
  '00000000-0000-0000-0000-000000000001',
  'LiNKtrend AIOS Internal',
  'aios-internal',
  'active'
)
on conflict (id) do update set
  venture_name = excluded.venture_name,
  slug = excluded.slug,
  status = excluded.status,
  updated_at = now();

create table if not exists lb_shared.missions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references lb_core.tenants(id) on delete cascade,
  mission_key text not null,
  parent_mission_id uuid references lb_shared.missions(id) on delete set null,
  goal text not null,
  status text not null check (status in ('active', 'paused', 'handover_pending', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(768),
  created_by_agent text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, mission_key)
);

create table if not exists lb_shared.policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references lb_core.tenants(id) on delete cascade,
  title text not null,
  policy_body text not null,
  policy_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(768),
  created_by_agent text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lb_shared.proposals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references lb_core.tenants(id) on delete cascade,
  proposal_key text not null,
  title text not null,
  decision text not null,
  decision_status text not null check (decision_status in ('draft', 'approved', 'rejected')),
  requires_review boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(768),
  created_by_agent text not null,
  approved_by_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, proposal_key)
);

create table if not exists lb_shared.lessons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references lb_core.tenants(id) on delete cascade,
  lesson_title text not null,
  lesson_body text not null,
  source_run_id text not null,
  source_agent_id text not null,
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  requires_review boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lb_shared.audit_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references lb_core.tenants(id) on delete cascade,
  run_id text not null,
  task_id text not null,
  dpr_id text not null,
  status text not null,
  token_usage integer,
  command_log jsonb not null default '[]'::jsonb,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, run_id, task_id, dpr_id)
);

create table if not exists lb_scratch.entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references lb_core.tenants(id) on delete cascade,
  run_id text not null,
  agent_id text not null,
  entry_type text not null,
  content text not null,
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  promoted boolean not null default false,
  promotion_target text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_missions_tenant on lb_shared.missions (tenant_id);
create index if not exists idx_policies_tenant on lb_shared.policies (tenant_id);
create index if not exists idx_proposals_tenant on lb_shared.proposals (tenant_id);
create index if not exists idx_lessons_tenant on lb_shared.lessons (tenant_id);
create index if not exists idx_audit_runs_tenant on lb_shared.audit_runs (tenant_id);
create index if not exists idx_scratch_entries_tenant on lb_scratch.entries (tenant_id);

create index if not exists idx_missions_embedding on lb_shared.missions using hnsw (embedding vector_cosine_ops);
create index if not exists idx_policies_embedding on lb_shared.policies using hnsw (embedding vector_cosine_ops);
create index if not exists idx_proposals_embedding on lb_shared.proposals using hnsw (embedding vector_cosine_ops);
create index if not exists idx_lessons_embedding on lb_shared.lessons using hnsw (embedding vector_cosine_ops);

alter table lb_shared.missions enable row level security;
alter table lb_shared.policies enable row level security;
alter table lb_shared.proposals enable row level security;
alter table lb_shared.lessons enable row level security;
alter table lb_shared.audit_runs enable row level security;
alter table lb_scratch.entries enable row level security;

create policy missions_tenant_policy on lb_shared.missions
  using (tenant_id = lb_core.current_tenant())
  with check (tenant_id = lb_core.current_tenant());

create policy policies_tenant_policy on lb_shared.policies
  using (tenant_id = lb_core.current_tenant())
  with check (tenant_id = lb_core.current_tenant());

create policy proposals_tenant_policy on lb_shared.proposals
  using (tenant_id = lb_core.current_tenant())
  with check (tenant_id = lb_core.current_tenant());

create policy lessons_tenant_policy on lb_shared.lessons
  using (tenant_id = lb_core.current_tenant())
  with check (tenant_id = lb_core.current_tenant());

create policy audit_runs_tenant_policy on lb_shared.audit_runs
  using (tenant_id = lb_core.current_tenant())
  with check (tenant_id = lb_core.current_tenant());

create policy scratch_entries_tenant_policy on lb_scratch.entries
  using (tenant_id = lb_core.current_tenant())
  with check (tenant_id = lb_core.current_tenant());

-- Deny direct table access for runtime roles.
revoke all on all tables in schema lb_shared from anon, authenticated, service_role;
revoke all on all tables in schema lb_scratch from anon, authenticated, service_role;

create or replace function lb_core.bootstrap_tenant(
  p_venture_name text,
  p_slug text,
  p_status text default 'active'
)
returns lb_core.tenants
language plpgsql
security definer
set search_path = lb_core, public
as $$
declare
  tenant_row lb_core.tenants;
begin
  insert into lb_core.tenants (venture_name, slug, status)
  values (p_venture_name, p_slug, p_status)
  on conflict (slug) do update set
    venture_name = excluded.venture_name,
    status = excluded.status,
    updated_at = now()
  returning * into tenant_row;

  return tenant_row;
end;
$$;

create or replace function lb_shared.upsert_mission(
  p_mission_key text,
  p_parent_mission_id uuid,
  p_goal text,
  p_status text,
  p_metadata jsonb,
  p_embedding vector(768),
  p_created_by_agent text
)
returns lb_shared.missions
language plpgsql
security definer
set search_path = lb_core, lb_shared, public
as $$
declare
  tenant_uuid uuid := lb_core.current_tenant();
  mission_row lb_shared.missions;
begin
  insert into lb_shared.missions (
    tenant_id,
    mission_key,
    parent_mission_id,
    goal,
    status,
    metadata,
    embedding,
    created_by_agent,
    updated_at
  ) values (
    tenant_uuid,
    p_mission_key,
    p_parent_mission_id,
    p_goal,
    p_status,
    coalesce(p_metadata, '{}'::jsonb),
    p_embedding,
    p_created_by_agent,
    now()
  )
  on conflict (tenant_id, mission_key)
  do update set
    parent_mission_id = excluded.parent_mission_id,
    goal = excluded.goal,
    status = excluded.status,
    metadata = excluded.metadata,
    embedding = excluded.embedding,
    updated_at = now()
  returning * into mission_row;

  return mission_row;
end;
$$;

create or replace function public.upsert_mission(
  p_tenant uuid,
  p_mission_key text,
  p_parent_mission_id uuid,
  p_goal text,
  p_status text,
  p_metadata jsonb,
  p_embedding vector(768),
  p_created_by_agent text
)
returns lb_shared.missions
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select lb_core.set_tenant_context(p_tenant);
  select lb_shared.upsert_mission(
    p_mission_key,
    p_parent_mission_id,
    p_goal,
    p_status,
    p_metadata,
    p_embedding,
    p_created_by_agent
  );
$$;

create or replace function lb_scratch.log_entry(
  p_run_id text,
  p_agent_id text,
  p_entry_type text,
  p_content text,
  p_confidence numeric,
  p_metadata jsonb
)
returns lb_scratch.entries
language plpgsql
security definer
set search_path = lb_core, lb_scratch, public
as $$
declare
  tenant_uuid uuid := lb_core.current_tenant();
  entry_row lb_scratch.entries;
begin
  insert into lb_scratch.entries (
    tenant_id,
    run_id,
    agent_id,
    entry_type,
    content,
    confidence,
    metadata
  ) values (
    tenant_uuid,
    p_run_id,
    p_agent_id,
    p_entry_type,
    p_content,
    p_confidence,
    coalesce(p_metadata, '{}'::jsonb)
  ) returning * into entry_row;

  return entry_row;
end;
$$;

create or replace function lb_shared.promote_scratch_to_lesson(
  p_entry_id uuid,
  p_lesson_title text,
  p_embedding vector(768)
)
returns lb_shared.lessons
language plpgsql
security definer
set search_path = lb_core, lb_shared, lb_scratch, public
as $$
declare
  tenant_uuid uuid := lb_core.current_tenant();
  source_entry lb_scratch.entries;
  lesson_row lb_shared.lessons;
begin
  select * into source_entry
  from lb_scratch.entries
  where id = p_entry_id
    and tenant_id = tenant_uuid;

  if not found then
    raise exception 'scratch entry not found for tenant';
  end if;

  if source_entry.confidence < 0.85 then
    raise exception 'confidence below auto-promotion threshold';
  end if;

  insert into lb_shared.lessons (
    tenant_id,
    lesson_title,
    lesson_body,
    source_run_id,
    source_agent_id,
    confidence,
    requires_review,
    metadata,
    embedding
  ) values (
    tenant_uuid,
    p_lesson_title,
    source_entry.content,
    source_entry.run_id,
    source_entry.agent_id,
    source_entry.confidence,
    true,
    jsonb_build_object('promoted_from', source_entry.id),
    p_embedding
  ) returning * into lesson_row;

  update lb_scratch.entries
  set promoted = true,
      promotion_target = lesson_row.id::text,
      updated_at = now()
  where id = source_entry.id;

  return lesson_row;
end;
$$;

create or replace function lb_shared.search_lessons(
  p_query_embedding vector(768),
  p_match_count integer default 8
)
returns table (
  id uuid,
  tenant_id uuid,
  lesson_title text,
  lesson_body text,
  confidence numeric,
  similarity float
)
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select
    l.id,
    l.tenant_id,
    l.lesson_title,
    l.lesson_body,
    l.confidence,
    1 - (l.embedding <=> p_query_embedding) as similarity
  from lb_shared.lessons l
  where l.tenant_id = lb_core.current_tenant()
  order by l.embedding <=> p_query_embedding
  limit greatest(p_match_count, 1);
$$;

create or replace function lb_shared.log_audit_run(
  p_run_id text,
  p_task_id text,
  p_dpr_id text,
  p_status text,
  p_token_usage integer,
  p_command_log jsonb,
  p_details jsonb
)
returns lb_shared.audit_runs
language plpgsql
security definer
set search_path = lb_core, lb_shared, public
as $$
declare
  tenant_uuid uuid := lb_core.current_tenant();
  run_row lb_shared.audit_runs;
begin
  insert into lb_shared.audit_runs (
    tenant_id,
    run_id,
    task_id,
    dpr_id,
    status,
    token_usage,
    command_log,
    details
  ) values (
    tenant_uuid,
    p_run_id,
    p_task_id,
    p_dpr_id,
    p_status,
    p_token_usage,
    coalesce(p_command_log, '[]'::jsonb),
    coalesce(p_details, '{}'::jsonb)
  )
  on conflict (tenant_id, run_id, task_id, dpr_id)
  do update set
    status = excluded.status,
    token_usage = excluded.token_usage,
    command_log = excluded.command_log,
    details = excluded.details
  returning * into run_row;

  return run_row;
end;
$$;

create or replace function public.log_audit_run(
  p_tenant uuid,
  p_run_id text,
  p_task_id text,
  p_dpr_id text,
  p_status text,
  p_token_usage integer,
  p_command_log jsonb,
  p_details jsonb
)
returns lb_shared.audit_runs
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select lb_core.set_tenant_context(p_tenant);
  select lb_shared.log_audit_run(
    p_run_id,
    p_task_id,
    p_dpr_id,
    p_status,
    p_token_usage,
    p_command_log,
    p_details
  );
$$;

create or replace function public.bootstrap_tenant(
  p_tenant_name text,
  p_slug text,
  p_status text default 'active'
)
returns lb_core.tenants
language sql
security definer
set search_path = lb_core, public
as $$
  select lb_core.bootstrap_tenant(p_tenant_name, p_slug, p_status);
$$;

create or replace function public.list_audit_runs(
  p_tenant uuid,
  p_run_id text default null
)
returns setof lb_shared.audit_runs
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select lb_core.set_tenant_context(p_tenant);
  select ar.*
  from lb_shared.audit_runs ar
  where ar.tenant_id = p_tenant
    and (p_run_id is null or ar.run_id = p_run_id)
  order by ar.created_at desc;
$$;

create or replace function public.set_tenant_context(p_tenant uuid)
returns void
language sql
security definer
set search_path = lb_core, public
as $$
  select lb_core.set_tenant_context(p_tenant);
$$;

grant usage on schema lb_core, lb_shared, lb_scratch to service_role;
grant execute on function lb_core.current_tenant() to service_role;
grant execute on function lb_core.set_tenant_context(uuid) to service_role;
grant execute on function lb_core.bootstrap_tenant(text, text, text) to service_role;
grant execute on function lb_shared.upsert_mission(text, uuid, text, text, jsonb, vector, text) to service_role;
grant execute on function lb_scratch.log_entry(text, text, text, text, numeric, jsonb) to service_role;
grant execute on function lb_shared.promote_scratch_to_lesson(uuid, text, vector) to service_role;
grant execute on function lb_shared.search_lessons(vector, integer) to service_role;
grant execute on function lb_shared.log_audit_run(text, text, text, text, integer, jsonb, jsonb) to service_role;
grant execute on function public.set_tenant_context(uuid) to service_role;
grant execute on function public.upsert_mission(uuid, text, uuid, text, text, jsonb, vector, text) to service_role;
grant execute on function public.log_audit_run(uuid, text, text, text, text, integer, jsonb, jsonb) to service_role;
grant execute on function public.bootstrap_tenant(text, text, text) to service_role;
grant execute on function public.list_audit_runs(uuid, text) to service_role;
