-- Agent model-role profiles for function-specific orchestration (Lisa-first rollout)

create table if not exists lb_shared.agent_model_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references lb_core.tenants(id) on delete cascade,
  dpr_id text not null,
  reasoning_model text not null,
  context_model text not null,
  execution_model text not null,
  review_model text,
  heartbeat_model text,
  dynamic_sequencing boolean not null default true,
  review_required boolean not null default true,
  max_review_loops integer not null default 1 check (max_review_loops between 0 and 5),
  policy_metadata jsonb not null default '{}'::jsonb,
  updated_by_agent text not null,
  updated_at timestamptz not null default now(),
  unique (tenant_id, dpr_id)
);

create index if not exists idx_agent_model_profiles_tenant
on lb_shared.agent_model_profiles (tenant_id, dpr_id);

alter table lb_shared.agent_model_profiles enable row level security;

drop policy if exists agent_model_profiles_tenant_policy on lb_shared.agent_model_profiles;
create policy agent_model_profiles_tenant_policy
on lb_shared.agent_model_profiles
  using (tenant_id = lb_core.current_tenant())
  with check (tenant_id = lb_core.current_tenant());

revoke all on lb_shared.agent_model_profiles from anon, authenticated, service_role;

create or replace function lb_shared.upsert_agent_model_profile(
  p_dpr_id text,
  p_reasoning_model text,
  p_context_model text,
  p_execution_model text,
  p_review_model text,
  p_heartbeat_model text,
  p_dynamic_sequencing boolean,
  p_review_required boolean,
  p_max_review_loops integer,
  p_policy_metadata jsonb,
  p_updated_by_agent text
)
returns lb_shared.agent_model_profiles
language plpgsql
security definer
set search_path = lb_core, lb_shared, public
as $$
declare
  tenant_uuid uuid := lb_core.current_tenant();
  profile_row lb_shared.agent_model_profiles;
begin
  insert into lb_shared.agent_model_profiles (
    tenant_id,
    dpr_id,
    reasoning_model,
    context_model,
    execution_model,
    review_model,
    heartbeat_model,
    dynamic_sequencing,
    review_required,
    max_review_loops,
    policy_metadata,
    updated_by_agent,
    updated_at
  ) values (
    tenant_uuid,
    p_dpr_id,
    p_reasoning_model,
    p_context_model,
    p_execution_model,
    p_review_model,
    p_heartbeat_model,
    coalesce(p_dynamic_sequencing, true),
    coalesce(p_review_required, true),
    coalesce(p_max_review_loops, 1),
    coalesce(p_policy_metadata, '{}'::jsonb),
    p_updated_by_agent,
    now()
  )
  on conflict (tenant_id, dpr_id)
  do update set
    reasoning_model = excluded.reasoning_model,
    context_model = excluded.context_model,
    execution_model = excluded.execution_model,
    review_model = excluded.review_model,
    heartbeat_model = excluded.heartbeat_model,
    dynamic_sequencing = excluded.dynamic_sequencing,
    review_required = excluded.review_required,
    max_review_loops = excluded.max_review_loops,
    policy_metadata = excluded.policy_metadata,
    updated_by_agent = excluded.updated_by_agent,
    updated_at = now()
  returning * into profile_row;

  return profile_row;
end;
$$;

create or replace function lb_shared.get_agent_model_profile(
  p_dpr_id text
)
returns lb_shared.agent_model_profiles
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select amp.*
  from lb_shared.agent_model_profiles amp
  where amp.tenant_id = lb_core.current_tenant()
    and amp.dpr_id = p_dpr_id
  limit 1;
$$;

create or replace function public.upsert_agent_model_profile(
  p_tenant uuid,
  p_dpr_id text,
  p_reasoning_model text,
  p_context_model text,
  p_execution_model text,
  p_review_model text,
  p_heartbeat_model text,
  p_dynamic_sequencing boolean,
  p_review_required boolean,
  p_max_review_loops integer,
  p_policy_metadata jsonb,
  p_updated_by_agent text
)
returns lb_shared.agent_model_profiles
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select lb_core.set_tenant_context(p_tenant);
  select lb_shared.upsert_agent_model_profile(
    p_dpr_id,
    p_reasoning_model,
    p_context_model,
    p_execution_model,
    p_review_model,
    p_heartbeat_model,
    p_dynamic_sequencing,
    p_review_required,
    p_max_review_loops,
    p_policy_metadata,
    p_updated_by_agent
  );
$$;

create or replace function public.get_agent_model_profile(
  p_tenant uuid,
  p_dpr_id text
)
returns lb_shared.agent_model_profiles
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select lb_core.set_tenant_context(p_tenant);
  select lb_shared.get_agent_model_profile(p_dpr_id);
$$;

grant execute on function lb_shared.upsert_agent_model_profile(text, text, text, text, text, text, boolean, boolean, integer, jsonb, text) to service_role;
grant execute on function lb_shared.get_agent_model_profile(text) to service_role;
grant execute on function public.upsert_agent_model_profile(uuid, text, text, text, text, text, text, boolean, boolean, integer, jsonb, text) to service_role;
grant execute on function public.get_agent_model_profile(uuid, text) to service_role;
