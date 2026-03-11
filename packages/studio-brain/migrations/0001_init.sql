-- AIOS Studio Brain bootstrap
-- Applies to Supabase project: LiNKtrend AIOS

create extension if not exists vector;
create extension if not exists pgcrypto;

create schema if not exists core;
create schema if not exists shared_memory;
create schema if not exists scratch_memory;

create or replace function core.current_tenant()
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

create or replace function core.set_tenant_context(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = public, core
as $$
begin
  perform set_config('app.current_tenant', p_tenant::text, true);
end;
$$;

create table if not exists core.tenants (
  id uuid primary key default gen_random_uuid(),
  venture_name text not null unique,
  slug text not null unique,
  status text not null check (status in ('active', 'paused', 'handover_pending', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shared_memory.missions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references core.tenants(id) on delete cascade,
  mission_key text not null,
  parent_mission_id uuid references shared_memory.missions(id) on delete set null,
  goal text not null,
  status text not null check (status in ('active', 'paused', 'handover_pending', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(768),
  created_by_agent text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, mission_key)
);

create table if not exists shared_memory.policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references core.tenants(id) on delete cascade,
  title text not null,
  policy_body text not null,
  policy_version text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(768),
  created_by_agent text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shared_memory.proposals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references core.tenants(id) on delete cascade,
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

create table if not exists shared_memory.lessons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references core.tenants(id) on delete cascade,
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

create table if not exists shared_memory.audit_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references core.tenants(id) on delete cascade,
  run_id text not null,
  task_id text not null,
  agent_id text not null,
  status text not null,
  token_usage integer,
  command_log jsonb not null default '[]'::jsonb,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, run_id, task_id)
);

create table if not exists scratch_memory.entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references core.tenants(id) on delete cascade,
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

create index if not exists idx_missions_tenant on shared_memory.missions (tenant_id);
create index if not exists idx_policies_tenant on shared_memory.policies (tenant_id);
create index if not exists idx_proposals_tenant on shared_memory.proposals (tenant_id);
create index if not exists idx_lessons_tenant on shared_memory.lessons (tenant_id);
create index if not exists idx_audit_runs_tenant on shared_memory.audit_runs (tenant_id);
create index if not exists idx_scratch_entries_tenant on scratch_memory.entries (tenant_id);

create index if not exists idx_missions_embedding on shared_memory.missions using hnsw (embedding vector_cosine_ops);
create index if not exists idx_policies_embedding on shared_memory.policies using hnsw (embedding vector_cosine_ops);
create index if not exists idx_proposals_embedding on shared_memory.proposals using hnsw (embedding vector_cosine_ops);
create index if not exists idx_lessons_embedding on shared_memory.lessons using hnsw (embedding vector_cosine_ops);

alter table shared_memory.missions enable row level security;
alter table shared_memory.policies enable row level security;
alter table shared_memory.proposals enable row level security;
alter table shared_memory.lessons enable row level security;
alter table shared_memory.audit_runs enable row level security;
alter table scratch_memory.entries enable row level security;

create policy missions_tenant_policy on shared_memory.missions
  using (tenant_id = core.current_tenant())
  with check (tenant_id = core.current_tenant());

create policy policies_tenant_policy on shared_memory.policies
  using (tenant_id = core.current_tenant())
  with check (tenant_id = core.current_tenant());

create policy proposals_tenant_policy on shared_memory.proposals
  using (tenant_id = core.current_tenant())
  with check (tenant_id = core.current_tenant());

create policy lessons_tenant_policy on shared_memory.lessons
  using (tenant_id = core.current_tenant())
  with check (tenant_id = core.current_tenant());

create policy audit_runs_tenant_policy on shared_memory.audit_runs
  using (tenant_id = core.current_tenant())
  with check (tenant_id = core.current_tenant());

create policy scratch_entries_tenant_policy on scratch_memory.entries
  using (tenant_id = core.current_tenant())
  with check (tenant_id = core.current_tenant());

-- Deny direct table access for runtime roles.
revoke all on all tables in schema shared_memory from anon, authenticated, service_role;
revoke all on all tables in schema scratch_memory from anon, authenticated, service_role;

create or replace function core.bootstrap_tenant(
  p_venture_name text,
  p_slug text,
  p_status text default 'active'
)
returns core.tenants
language plpgsql
security definer
set search_path = public, core
as $$
declare
  tenant_row core.tenants;
begin
  insert into core.tenants (venture_name, slug, status)
  values (p_venture_name, p_slug, p_status)
  on conflict (slug) do update set
    venture_name = excluded.venture_name,
    status = excluded.status,
    updated_at = now()
  returning * into tenant_row;

  return tenant_row;
end;
$$;

create or replace function shared_memory.upsert_mission(
  p_mission_key text,
  p_parent_mission_id uuid,
  p_goal text,
  p_status text,
  p_metadata jsonb,
  p_embedding vector(768),
  p_created_by_agent text
)
returns shared_memory.missions
language plpgsql
security definer
set search_path = public, core, shared_memory
as $$
declare
  tenant_uuid uuid := core.current_tenant();
  mission_row shared_memory.missions;
begin
  insert into shared_memory.missions (
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
  p_mission_key text,
  p_parent_mission_id uuid,
  p_goal text,
  p_status text,
  p_metadata jsonb,
  p_embedding vector(768),
  p_created_by_agent text
)
returns shared_memory.missions
language sql
security definer
set search_path = public, core, shared_memory
as $$
  select shared_memory.upsert_mission(
    p_mission_key,
    p_parent_mission_id,
    p_goal,
    p_status,
    p_metadata,
    p_embedding,
    p_created_by_agent
  );
$$;

create or replace function scratch_memory.log_entry(
  p_run_id text,
  p_agent_id text,
  p_entry_type text,
  p_content text,
  p_confidence numeric,
  p_metadata jsonb
)
returns scratch_memory.entries
language plpgsql
security definer
set search_path = public, core, scratch_memory
as $$
declare
  tenant_uuid uuid := core.current_tenant();
  entry_row scratch_memory.entries;
begin
  insert into scratch_memory.entries (
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

create or replace function shared_memory.promote_scratch_to_lesson(
  p_entry_id uuid,
  p_lesson_title text,
  p_embedding vector(768)
)
returns shared_memory.lessons
language plpgsql
security definer
set search_path = public, core, shared_memory, scratch_memory
as $$
declare
  tenant_uuid uuid := core.current_tenant();
  source_entry scratch_memory.entries;
  lesson_row shared_memory.lessons;
begin
  select * into source_entry
  from scratch_memory.entries
  where id = p_entry_id
    and tenant_id = tenant_uuid;

  if not found then
    raise exception 'scratch entry not found for tenant';
  end if;

  if source_entry.confidence < 0.85 then
    raise exception 'confidence below auto-promotion threshold';
  end if;

  insert into shared_memory.lessons (
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

  update scratch_memory.entries
  set promoted = true,
      promotion_target = lesson_row.id::text,
      updated_at = now()
  where id = source_entry.id;

  return lesson_row;
end;
$$;

create or replace function shared_memory.search_lessons(
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
set search_path = public, core, shared_memory
as $$
  select
    l.id,
    l.tenant_id,
    l.lesson_title,
    l.lesson_body,
    l.confidence,
    1 - (l.embedding <=> p_query_embedding) as similarity
  from shared_memory.lessons l
  where l.tenant_id = core.current_tenant()
  order by l.embedding <=> p_query_embedding
  limit greatest(p_match_count, 1);
$$;

create or replace function shared_memory.log_audit_run(
  p_run_id text,
  p_task_id text,
  p_agent_id text,
  p_status text,
  p_token_usage integer,
  p_command_log jsonb,
  p_details jsonb
)
returns shared_memory.audit_runs
language plpgsql
security definer
set search_path = public, core, shared_memory
as $$
declare
  tenant_uuid uuid := core.current_tenant();
  run_row shared_memory.audit_runs;
begin
  insert into shared_memory.audit_runs (
    tenant_id,
    run_id,
    task_id,
    agent_id,
    status,
    token_usage,
    command_log,
    details
  ) values (
    tenant_uuid,
    p_run_id,
    p_task_id,
    p_agent_id,
    p_status,
    p_token_usage,
    coalesce(p_command_log, '[]'::jsonb),
    coalesce(p_details, '{}'::jsonb)
  )
  on conflict (tenant_id, run_id, task_id)
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
  p_run_id text,
  p_task_id text,
  p_agent_id text,
  p_status text,
  p_token_usage integer,
  p_command_log jsonb,
  p_details jsonb
)
returns shared_memory.audit_runs
language sql
security definer
set search_path = public, core, shared_memory
as $$
  select shared_memory.log_audit_run(
    p_run_id,
    p_task_id,
    p_agent_id,
    p_status,
    p_token_usage,
    p_command_log,
    p_details
  );
$$;

create or replace function public.set_tenant_context(p_tenant uuid)
returns void
language sql
security definer
set search_path = public, core
as $$
  select core.set_tenant_context(p_tenant);
$$;

grant usage on schema core, shared_memory, scratch_memory to service_role;
grant execute on function core.current_tenant() to service_role;
grant execute on function core.set_tenant_context(uuid) to service_role;
grant execute on function core.bootstrap_tenant(text, text, text) to service_role;
grant execute on function shared_memory.upsert_mission(text, uuid, text, text, jsonb, vector, text) to service_role;
grant execute on function scratch_memory.log_entry(text, text, text, text, numeric, jsonb) to service_role;
grant execute on function shared_memory.promote_scratch_to_lesson(uuid, text, vector) to service_role;
grant execute on function shared_memory.search_lessons(vector, integer) to service_role;
grant execute on function shared_memory.log_audit_run(text, text, text, text, integer, jsonb, jsonb) to service_role;
grant execute on function public.set_tenant_context(uuid) to service_role;
grant execute on function public.upsert_mission(text, uuid, text, text, jsonb, vector, text) to service_role;
grant execute on function public.log_audit_run(text, text, text, text, integer, jsonb, jsonb) to service_role;
