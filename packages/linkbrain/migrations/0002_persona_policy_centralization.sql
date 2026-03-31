-- Persona + Policy centralization for LiNKbrain

create table if not exists lb_shared.knowledge_entities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references lb_core.tenants(id) on delete cascade,
  entity_kind text not null check (entity_kind in ('persona', 'policy', 'guideline', 'guardrail', 'sop')),
  content_kind text not null check (
    content_kind in (
      'user',
      'identity',
      'soul',
      'agents',
      'memory',
      'runtime_rules',
      'policy_text',
      'guideline_text',
      'guardrail_text',
      'sop_text'
    )
  ),
  scope_kind text not null check (
    scope_kind in ('global', 'type', 'role', 'agent_override', 'memory_seed', 'runtime_rules')
  ),
  scope_key text not null,
  title text not null,
  status text not null check (status in ('draft', 'review', 'approved', 'published', 'deprecated')),
  created_by_agent text not null,
  approved_by_agent text,
  metadata jsonb not null default '{}'::jsonb,
  published_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, entity_kind, content_kind, scope_kind, scope_key, title)
);

create table if not exists lb_shared.knowledge_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references lb_core.tenants(id) on delete cascade,
  entity_id uuid not null references lb_shared.knowledge_entities(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  status text not null check (status in ('draft', 'review', 'approved', 'published', 'deprecated')),
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  content_hash text not null,
  created_by_agent text not null,
  approved_by_agent text,
  published_at timestamptz,
  rolled_back_from_revision_id uuid references lb_shared.knowledge_revisions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (entity_id, revision_number)
);

alter table lb_shared.knowledge_entities
  add constraint knowledge_entities_published_revision_fk
  foreign key (published_revision_id)
  references lb_shared.knowledge_revisions(id)
  on delete set null;

create table if not exists lb_shared.persona_compiled_bundles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references lb_core.tenants(id) on delete cascade,
  dpr_id text not null,
  source_revision_ids uuid[] not null default '{}'::uuid[],
  bundle jsonb not null default '{}'::jsonb,
  content_hash text not null,
  published_at timestamptz not null default now(),
  created_by_agent text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, dpr_id, content_hash)
);

create table if not exists lb_shared.persona_agent_sync_state (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references lb_core.tenants(id) on delete cascade,
  dpr_id text not null,
  expected_revision_hash text,
  acknowledged_revision_hash text,
  policy_package text,
  sync_status text not null check (sync_status in ('unknown', 'synced', 'drift', 'error')),
  sync_metadata jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  last_ack_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (tenant_id, dpr_id)
);

create table if not exists lb_shared.persona_revision_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references lb_core.tenants(id) on delete cascade,
  entity_id uuid not null references lb_shared.knowledge_entities(id) on delete cascade,
  revision_id uuid references lb_shared.knowledge_revisions(id) on delete set null,
  action text not null check (action in ('created', 'submitted_review', 'approved', 'published', 'rolled_back')),
  actor_dpr_id text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists lb_shared.policy_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references lb_core.tenants(id) on delete cascade,
  run_id text,
  task_id text,
  dpr_id text not null,
  policy_package text,
  decision text not null check (decision in ('allow', 'deny', 'require_approval')),
  reason text not null,
  destination text,
  tool_name text,
  data_sensitivity text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists lb_shared.kill_switch_states (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references lb_core.tenants(id) on delete cascade,
  scope text not null check (scope in ('agent', 'workflow', 'tenant', 'global')),
  target_key text not null,
  state text not null check (state in ('active', 'released')),
  reason text not null,
  actor_dpr_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_kill_switch_active_unique
on lb_shared.kill_switch_states (tenant_id, scope, target_key)
where state = 'active';

create index if not exists idx_knowledge_entities_tenant on lb_shared.knowledge_entities (tenant_id);
create index if not exists idx_knowledge_entities_scope on lb_shared.knowledge_entities (tenant_id, scope_kind, scope_key);
create index if not exists idx_knowledge_revisions_tenant on lb_shared.knowledge_revisions (tenant_id, entity_id, revision_number desc);
create index if not exists idx_persona_bundles_tenant on lb_shared.persona_compiled_bundles (tenant_id, dpr_id, created_at desc);
create index if not exists idx_persona_sync_tenant on lb_shared.persona_agent_sync_state (tenant_id, dpr_id);
create index if not exists idx_persona_revision_audit_tenant on lb_shared.persona_revision_audit (tenant_id, created_at desc);
create index if not exists idx_policy_decisions_tenant on lb_shared.policy_decisions (tenant_id, created_at desc);
create index if not exists idx_kill_switch_tenant on lb_shared.kill_switch_states (tenant_id, created_at desc);

alter table lb_shared.knowledge_entities enable row level security;
alter table lb_shared.knowledge_revisions enable row level security;
alter table lb_shared.persona_compiled_bundles enable row level security;
alter table lb_shared.persona_agent_sync_state enable row level security;
alter table lb_shared.persona_revision_audit enable row level security;
alter table lb_shared.policy_decisions enable row level security;
alter table lb_shared.kill_switch_states enable row level security;

create policy knowledge_entities_tenant_policy on lb_shared.knowledge_entities
  using (tenant_id = lb_core.current_tenant())
  with check (tenant_id = lb_core.current_tenant());

create policy knowledge_revisions_tenant_policy on lb_shared.knowledge_revisions
  using (tenant_id = lb_core.current_tenant())
  with check (tenant_id = lb_core.current_tenant());

create policy persona_compiled_bundles_tenant_policy on lb_shared.persona_compiled_bundles
  using (tenant_id = lb_core.current_tenant())
  with check (tenant_id = lb_core.current_tenant());

create policy persona_agent_sync_state_tenant_policy on lb_shared.persona_agent_sync_state
  using (tenant_id = lb_core.current_tenant())
  with check (tenant_id = lb_core.current_tenant());

create policy persona_revision_audit_tenant_policy on lb_shared.persona_revision_audit
  using (tenant_id = lb_core.current_tenant())
  with check (tenant_id = lb_core.current_tenant());

create policy policy_decisions_tenant_policy on lb_shared.policy_decisions
  using (tenant_id = lb_core.current_tenant())
  with check (tenant_id = lb_core.current_tenant());

create policy kill_switch_states_tenant_policy on lb_shared.kill_switch_states
  using (tenant_id = lb_core.current_tenant())
  with check (tenant_id = lb_core.current_tenant());

revoke all on lb_shared.knowledge_entities from anon, authenticated, service_role;
revoke all on lb_shared.knowledge_revisions from anon, authenticated, service_role;
revoke all on lb_shared.persona_compiled_bundles from anon, authenticated, service_role;
revoke all on lb_shared.persona_agent_sync_state from anon, authenticated, service_role;
revoke all on lb_shared.persona_revision_audit from anon, authenticated, service_role;
revoke all on lb_shared.policy_decisions from anon, authenticated, service_role;
revoke all on lb_shared.kill_switch_states from anon, authenticated, service_role;

create or replace function lb_shared.guard_knowledge_revision_update()
returns trigger
language plpgsql
as $$
begin
  if new.body <> old.body then
    raise exception 'knowledge revision body is immutable';
  end if;
  if new.content_hash <> old.content_hash then
    raise exception 'knowledge revision hash is immutable';
  end if;
  if new.metadata <> old.metadata then
    raise exception 'knowledge revision metadata is immutable';
  end if;
  if new.entity_id <> old.entity_id or new.tenant_id <> old.tenant_id then
    raise exception 'knowledge revision ownership is immutable';
  end if;
  if new.revision_number <> old.revision_number then
    raise exception 'knowledge revision number is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_knowledge_revision_update on lb_shared.knowledge_revisions;
create trigger trg_guard_knowledge_revision_update
before update on lb_shared.knowledge_revisions
for each row execute function lb_shared.guard_knowledge_revision_update();

create or replace function lb_shared.create_knowledge_entity(
  p_entity_kind text,
  p_content_kind text,
  p_scope_kind text,
  p_scope_key text,
  p_title text,
  p_status text,
  p_created_by_agent text,
  p_metadata jsonb
)
returns lb_shared.knowledge_entities
language plpgsql
security definer
set search_path = lb_core, lb_shared, public
as $$
declare
  tenant_uuid uuid := lb_core.current_tenant();
  entity_row lb_shared.knowledge_entities;
begin
  insert into lb_shared.knowledge_entities (
    tenant_id,
    entity_kind,
    content_kind,
    scope_kind,
    scope_key,
    title,
    status,
    created_by_agent,
    metadata,
    updated_at
  ) values (
    tenant_uuid,
    p_entity_kind,
    p_content_kind,
    p_scope_kind,
    p_scope_key,
    p_title,
    p_status,
    p_created_by_agent,
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  on conflict (tenant_id, entity_kind, content_kind, scope_kind, scope_key, title)
  do update set
    status = excluded.status,
    metadata = excluded.metadata,
    updated_at = now()
  returning * into entity_row;

  return entity_row;
end;
$$;

create or replace function lb_shared.create_knowledge_revision(
  p_entity_id uuid,
  p_status text,
  p_body text,
  p_metadata jsonb,
  p_content_hash text,
  p_created_by_agent text,
  p_rolled_back_from_revision_id uuid default null
)
returns lb_shared.knowledge_revisions
language plpgsql
security definer
set search_path = lb_core, lb_shared, public
as $$
declare
  tenant_uuid uuid := lb_core.current_tenant();
  next_revision integer;
  revision_row lb_shared.knowledge_revisions;
  entity_row lb_shared.knowledge_entities;
begin
  select * into entity_row
  from lb_shared.knowledge_entities
  where id = p_entity_id and tenant_id = tenant_uuid;

  if not found then
    raise exception 'knowledge entity not found for tenant';
  end if;

  select coalesce(max(revision_number), 0) + 1
  into next_revision
  from lb_shared.knowledge_revisions
  where entity_id = p_entity_id and tenant_id = tenant_uuid;

  insert into lb_shared.knowledge_revisions (
    tenant_id,
    entity_id,
    revision_number,
    status,
    body,
    metadata,
    content_hash,
    created_by_agent,
    rolled_back_from_revision_id
  ) values (
    tenant_uuid,
    p_entity_id,
    next_revision,
    p_status,
    p_body,
    coalesce(p_metadata, '{}'::jsonb),
    p_content_hash,
    p_created_by_agent,
    p_rolled_back_from_revision_id
  )
  returning * into revision_row;

  insert into lb_shared.persona_revision_audit (
    tenant_id,
    entity_id,
    revision_id,
    action,
    actor_dpr_id,
    metadata
  ) values (
    tenant_uuid,
    p_entity_id,
    revision_row.id,
    'created',
    p_created_by_agent,
    jsonb_build_object('status', p_status)
  );

  return revision_row;
end;
$$;

create or replace function lb_shared.publish_knowledge_revision(
  p_entity_id uuid,
  p_revision_id uuid,
  p_actor_dpr_id text,
  p_reason text default null
)
returns lb_shared.knowledge_revisions
language plpgsql
security definer
set search_path = lb_core, lb_shared, public
as $$
declare
  tenant_uuid uuid := lb_core.current_tenant();
  revision_row lb_shared.knowledge_revisions;
begin
  select * into revision_row
  from lb_shared.knowledge_revisions
  where id = p_revision_id
    and entity_id = p_entity_id
    and tenant_id = tenant_uuid;

  if not found then
    raise exception 'knowledge revision not found for tenant';
  end if;

  update lb_shared.knowledge_revisions
  set status = 'published',
      approved_by_agent = p_actor_dpr_id,
      published_at = now()
  where id = p_revision_id;

  update lb_shared.knowledge_entities
  set status = 'published',
      approved_by_agent = p_actor_dpr_id,
      published_revision_id = p_revision_id,
      updated_at = now()
  where id = p_entity_id
    and tenant_id = tenant_uuid;

  insert into lb_shared.persona_revision_audit (
    tenant_id,
    entity_id,
    revision_id,
    action,
    actor_dpr_id,
    reason,
    metadata
  ) values (
    tenant_uuid,
    p_entity_id,
    p_revision_id,
    'published',
    p_actor_dpr_id,
    p_reason,
    '{}'::jsonb
  );

  select * into revision_row
  from lb_shared.knowledge_revisions
  where id = p_revision_id;

  return revision_row;
end;
$$;

create or replace function lb_shared.rollback_knowledge_entity(
  p_entity_id uuid,
  p_target_revision_id uuid,
  p_actor_dpr_id text,
  p_reason text
)
returns lb_shared.knowledge_revisions
language plpgsql
security definer
set search_path = lb_core, lb_shared, public
as $$
declare
  tenant_uuid uuid := lb_core.current_tenant();
  target_revision lb_shared.knowledge_revisions;
  rollback_revision lb_shared.knowledge_revisions;
  next_revision integer;
begin
  select * into target_revision
  from lb_shared.knowledge_revisions
  where id = p_target_revision_id
    and entity_id = p_entity_id
    and tenant_id = tenant_uuid;

  if not found then
    raise exception 'target revision not found for rollback';
  end if;

  select coalesce(max(revision_number), 0) + 1
  into next_revision
  from lb_shared.knowledge_revisions
  where entity_id = p_entity_id
    and tenant_id = tenant_uuid;

  insert into lb_shared.knowledge_revisions (
    tenant_id,
    entity_id,
    revision_number,
    status,
    body,
    metadata,
    content_hash,
    created_by_agent,
    approved_by_agent,
    published_at,
    rolled_back_from_revision_id
  ) values (
    tenant_uuid,
    p_entity_id,
    next_revision,
    'published',
    target_revision.body,
    target_revision.metadata,
    target_revision.content_hash,
    p_actor_dpr_id,
    p_actor_dpr_id,
    now(),
    target_revision.id
  )
  returning * into rollback_revision;

  update lb_shared.knowledge_entities
  set status = 'published',
      approved_by_agent = p_actor_dpr_id,
      published_revision_id = rollback_revision.id,
      updated_at = now()
  where id = p_entity_id
    and tenant_id = tenant_uuid;

  insert into lb_shared.persona_revision_audit (
    tenant_id,
    entity_id,
    revision_id,
    action,
    actor_dpr_id,
    reason,
    metadata
  ) values (
    tenant_uuid,
    p_entity_id,
    rollback_revision.id,
    'rolled_back',
    p_actor_dpr_id,
    p_reason,
    jsonb_build_object('target_revision_id', p_target_revision_id)
  );

  return rollback_revision;
end;
$$;

create or replace function lb_shared.upsert_persona_compiled_bundle(
  p_dpr_id text,
  p_source_revision_ids uuid[],
  p_bundle jsonb,
  p_content_hash text,
  p_created_by_agent text,
  p_published_at timestamptz default now()
)
returns lb_shared.persona_compiled_bundles
language plpgsql
security definer
set search_path = lb_core, lb_shared, public
as $$
declare
  tenant_uuid uuid := lb_core.current_tenant();
  bundle_row lb_shared.persona_compiled_bundles;
begin
  insert into lb_shared.persona_compiled_bundles (
    tenant_id,
    dpr_id,
    source_revision_ids,
    bundle,
    content_hash,
    published_at,
    created_by_agent
  ) values (
    tenant_uuid,
    p_dpr_id,
    coalesce(p_source_revision_ids, '{}'::uuid[]),
    coalesce(p_bundle, '{}'::jsonb),
    p_content_hash,
    coalesce(p_published_at, now()),
    p_created_by_agent
  )
  on conflict (tenant_id, dpr_id, content_hash)
  do update set
    source_revision_ids = excluded.source_revision_ids,
    bundle = excluded.bundle,
    published_at = excluded.published_at,
    created_by_agent = excluded.created_by_agent
  returning * into bundle_row;

  return bundle_row;
end;
$$;

create or replace function lb_shared.get_latest_persona_bundle(
  p_dpr_id text
)
returns lb_shared.persona_compiled_bundles
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select pcb.*
  from lb_shared.persona_compiled_bundles pcb
  where pcb.tenant_id = lb_core.current_tenant()
    and pcb.dpr_id = p_dpr_id
  order by pcb.created_at desc
  limit 1;
$$;

create or replace function lb_shared.upsert_persona_agent_sync_state(
  p_dpr_id text,
  p_expected_revision_hash text,
  p_acknowledged_revision_hash text,
  p_policy_package text,
  p_sync_status text,
  p_sync_metadata jsonb,
  p_last_sync_at timestamptz,
  p_last_ack_at timestamptz
)
returns lb_shared.persona_agent_sync_state
language plpgsql
security definer
set search_path = lb_core, lb_shared, public
as $$
declare
  tenant_uuid uuid := lb_core.current_tenant();
  state_row lb_shared.persona_agent_sync_state;
begin
  insert into lb_shared.persona_agent_sync_state (
    tenant_id,
    dpr_id,
    expected_revision_hash,
    acknowledged_revision_hash,
    policy_package,
    sync_status,
    sync_metadata,
    last_sync_at,
    last_ack_at,
    updated_at
  ) values (
    tenant_uuid,
    p_dpr_id,
    p_expected_revision_hash,
    p_acknowledged_revision_hash,
    p_policy_package,
    coalesce(p_sync_status, 'unknown'),
    coalesce(p_sync_metadata, '{}'::jsonb),
    p_last_sync_at,
    p_last_ack_at,
    now()
  )
  on conflict (tenant_id, dpr_id)
  do update set
    expected_revision_hash = coalesce(excluded.expected_revision_hash, lb_shared.persona_agent_sync_state.expected_revision_hash),
    acknowledged_revision_hash = coalesce(excluded.acknowledged_revision_hash, lb_shared.persona_agent_sync_state.acknowledged_revision_hash),
    policy_package = coalesce(excluded.policy_package, lb_shared.persona_agent_sync_state.policy_package),
    sync_status = excluded.sync_status,
    sync_metadata = excluded.sync_metadata,
    last_sync_at = coalesce(excluded.last_sync_at, lb_shared.persona_agent_sync_state.last_sync_at),
    last_ack_at = coalesce(excluded.last_ack_at, lb_shared.persona_agent_sync_state.last_ack_at),
    updated_at = now()
  returning * into state_row;

  return state_row;
end;
$$;

create or replace function lb_shared.log_policy_decision(
  p_run_id text,
  p_task_id text,
  p_dpr_id text,
  p_policy_package text,
  p_decision text,
  p_reason text,
  p_destination text,
  p_tool_name text,
  p_data_sensitivity text,
  p_metadata jsonb
)
returns lb_shared.policy_decisions
language plpgsql
security definer
set search_path = lb_core, lb_shared, public
as $$
declare
  tenant_uuid uuid := lb_core.current_tenant();
  decision_row lb_shared.policy_decisions;
begin
  insert into lb_shared.policy_decisions (
    tenant_id,
    run_id,
    task_id,
    dpr_id,
    policy_package,
    decision,
    reason,
    destination,
    tool_name,
    data_sensitivity,
    metadata
  ) values (
    tenant_uuid,
    p_run_id,
    p_task_id,
    p_dpr_id,
    p_policy_package,
    p_decision,
    p_reason,
    p_destination,
    p_tool_name,
    p_data_sensitivity,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into decision_row;

  return decision_row;
end;
$$;

create or replace function lb_shared.set_kill_switch_state(
  p_scope text,
  p_target_key text,
  p_state text,
  p_reason text,
  p_actor_dpr_id text,
  p_metadata jsonb
)
returns lb_shared.kill_switch_states
language plpgsql
security definer
set search_path = lb_core, lb_shared, public
as $$
declare
  tenant_uuid uuid := lb_core.current_tenant();
  switch_row lb_shared.kill_switch_states;
begin
  if p_state = 'active' then
    update lb_shared.kill_switch_states
    set state = 'released'
    where tenant_id = tenant_uuid
      and scope = p_scope
      and target_key = p_target_key
      and state = 'active';
  end if;

  insert into lb_shared.kill_switch_states (
    tenant_id,
    scope,
    target_key,
    state,
    reason,
    actor_dpr_id,
    metadata
  ) values (
    tenant_uuid,
    p_scope,
    p_target_key,
    p_state,
    p_reason,
    p_actor_dpr_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into switch_row;

  return switch_row;
end;
$$;

create or replace function public.create_knowledge_entity(
  p_tenant uuid,
  p_entity_kind text,
  p_content_kind text,
  p_scope_kind text,
  p_scope_key text,
  p_title text,
  p_status text,
  p_created_by_agent text,
  p_metadata jsonb
)
returns lb_shared.knowledge_entities
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select lb_core.set_tenant_context(p_tenant);
  select lb_shared.create_knowledge_entity(
    p_entity_kind,
    p_content_kind,
    p_scope_kind,
    p_scope_key,
    p_title,
    p_status,
    p_created_by_agent,
    p_metadata
  );
$$;

create or replace function public.create_knowledge_revision(
  p_tenant uuid,
  p_entity_id uuid,
  p_status text,
  p_body text,
  p_metadata jsonb,
  p_content_hash text,
  p_created_by_agent text,
  p_rolled_back_from_revision_id uuid default null
)
returns lb_shared.knowledge_revisions
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select lb_core.set_tenant_context(p_tenant);
  select lb_shared.create_knowledge_revision(
    p_entity_id,
    p_status,
    p_body,
    p_metadata,
    p_content_hash,
    p_created_by_agent,
    p_rolled_back_from_revision_id
  );
$$;

create or replace function public.publish_knowledge_revision(
  p_tenant uuid,
  p_entity_id uuid,
  p_revision_id uuid,
  p_actor_dpr_id text,
  p_reason text default null
)
returns lb_shared.knowledge_revisions
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select lb_core.set_tenant_context(p_tenant);
  select lb_shared.publish_knowledge_revision(
    p_entity_id,
    p_revision_id,
    p_actor_dpr_id,
    p_reason
  );
$$;

create or replace function public.rollback_knowledge_entity(
  p_tenant uuid,
  p_entity_id uuid,
  p_target_revision_id uuid,
  p_actor_dpr_id text,
  p_reason text
)
returns lb_shared.knowledge_revisions
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select lb_core.set_tenant_context(p_tenant);
  select lb_shared.rollback_knowledge_entity(
    p_entity_id,
    p_target_revision_id,
    p_actor_dpr_id,
    p_reason
  );
$$;

create or replace function public.list_knowledge_entities(
  p_tenant uuid,
  p_entity_kind text default null
)
returns setof lb_shared.knowledge_entities
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select lb_core.set_tenant_context(p_tenant);
  select e.*
  from lb_shared.knowledge_entities e
  where e.tenant_id = p_tenant
    and (p_entity_kind is null or e.entity_kind = p_entity_kind)
  order by e.updated_at desc;
$$;

create or replace function public.list_knowledge_revisions(
  p_tenant uuid,
  p_entity_id uuid default null
)
returns setof lb_shared.knowledge_revisions
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select lb_core.set_tenant_context(p_tenant);
  select r.*
  from lb_shared.knowledge_revisions r
  where r.tenant_id = p_tenant
    and (p_entity_id is null or r.entity_id = p_entity_id)
  order by r.created_at desc;
$$;

create or replace function public.upsert_persona_compiled_bundle(
  p_tenant uuid,
  p_dpr_id text,
  p_source_revision_ids uuid[],
  p_bundle jsonb,
  p_content_hash text,
  p_created_by_agent text,
  p_published_at timestamptz default now()
)
returns lb_shared.persona_compiled_bundles
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select lb_core.set_tenant_context(p_tenant);
  select lb_shared.upsert_persona_compiled_bundle(
    p_dpr_id,
    p_source_revision_ids,
    p_bundle,
    p_content_hash,
    p_created_by_agent,
    p_published_at
  );
$$;

create or replace function public.get_latest_persona_bundle(
  p_tenant uuid,
  p_dpr_id text
)
returns lb_shared.persona_compiled_bundles
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select lb_core.set_tenant_context(p_tenant);
  select lb_shared.get_latest_persona_bundle(p_dpr_id);
$$;

create or replace function public.upsert_persona_agent_sync_state(
  p_tenant uuid,
  p_dpr_id text,
  p_expected_revision_hash text,
  p_acknowledged_revision_hash text,
  p_policy_package text,
  p_sync_status text,
  p_sync_metadata jsonb,
  p_last_sync_at timestamptz,
  p_last_ack_at timestamptz
)
returns lb_shared.persona_agent_sync_state
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select lb_core.set_tenant_context(p_tenant);
  select lb_shared.upsert_persona_agent_sync_state(
    p_dpr_id,
    p_expected_revision_hash,
    p_acknowledged_revision_hash,
    p_policy_package,
    p_sync_status,
    p_sync_metadata,
    p_last_sync_at,
    p_last_ack_at
  );
$$;

create or replace function public.list_persona_agent_sync_state(
  p_tenant uuid,
  p_dpr_id text default null
)
returns setof lb_shared.persona_agent_sync_state
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select lb_core.set_tenant_context(p_tenant);
  select s.*
  from lb_shared.persona_agent_sync_state s
  where s.tenant_id = p_tenant
    and (p_dpr_id is null or s.dpr_id = p_dpr_id)
  order by s.updated_at desc;
$$;

create or replace function public.list_persona_revision_audit(
  p_tenant uuid,
  p_entity_id uuid default null
)
returns setof lb_shared.persona_revision_audit
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select lb_core.set_tenant_context(p_tenant);
  select a.*
  from lb_shared.persona_revision_audit a
  where a.tenant_id = p_tenant
    and (p_entity_id is null or a.entity_id = p_entity_id)
  order by a.created_at desc;
$$;

create or replace function public.log_policy_decision(
  p_tenant uuid,
  p_run_id text,
  p_task_id text,
  p_dpr_id text,
  p_policy_package text,
  p_decision text,
  p_reason text,
  p_destination text,
  p_tool_name text,
  p_data_sensitivity text,
  p_metadata jsonb
)
returns lb_shared.policy_decisions
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select lb_core.set_tenant_context(p_tenant);
  select lb_shared.log_policy_decision(
    p_run_id,
    p_task_id,
    p_dpr_id,
    p_policy_package,
    p_decision,
    p_reason,
    p_destination,
    p_tool_name,
    p_data_sensitivity,
    p_metadata
  );
$$;

create or replace function public.set_kill_switch_state(
  p_tenant uuid,
  p_scope text,
  p_target_key text,
  p_state text,
  p_reason text,
  p_actor_dpr_id text,
  p_metadata jsonb
)
returns lb_shared.kill_switch_states
language sql
security definer
set search_path = lb_core, lb_shared, public
as $$
  select lb_core.set_tenant_context(p_tenant);
  select lb_shared.set_kill_switch_state(
    p_scope,
    p_target_key,
    p_state,
    p_reason,
    p_actor_dpr_id,
    p_metadata
  );
$$;

grant execute on function lb_shared.create_knowledge_entity(text, text, text, text, text, text, text, jsonb) to service_role;
grant execute on function lb_shared.create_knowledge_revision(uuid, text, text, jsonb, text, text, uuid) to service_role;
grant execute on function lb_shared.publish_knowledge_revision(uuid, uuid, text, text) to service_role;
grant execute on function lb_shared.rollback_knowledge_entity(uuid, uuid, text, text) to service_role;
grant execute on function lb_shared.upsert_persona_compiled_bundle(text, uuid[], jsonb, text, text, timestamptz) to service_role;
grant execute on function lb_shared.get_latest_persona_bundle(text) to service_role;
grant execute on function lb_shared.upsert_persona_agent_sync_state(text, text, text, text, text, jsonb, timestamptz, timestamptz) to service_role;
grant execute on function lb_shared.log_policy_decision(text, text, text, text, text, text, text, text, text, jsonb) to service_role;
grant execute on function lb_shared.set_kill_switch_state(text, text, text, text, text, jsonb) to service_role;

grant execute on function public.create_knowledge_entity(uuid, text, text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.create_knowledge_revision(uuid, uuid, text, text, jsonb, text, text, uuid) to service_role;
grant execute on function public.publish_knowledge_revision(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.rollback_knowledge_entity(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.list_knowledge_entities(uuid, text) to service_role;
grant execute on function public.list_knowledge_revisions(uuid, uuid) to service_role;
grant execute on function public.upsert_persona_compiled_bundle(uuid, text, uuid[], jsonb, text, text, timestamptz) to service_role;
grant execute on function public.get_latest_persona_bundle(uuid, text) to service_role;
grant execute on function public.upsert_persona_agent_sync_state(uuid, text, text, text, text, text, jsonb, timestamptz, timestamptz) to service_role;
grant execute on function public.list_persona_agent_sync_state(uuid, text) to service_role;
grant execute on function public.list_persona_revision_audit(uuid, uuid) to service_role;
grant execute on function public.log_policy_decision(uuid, text, text, text, text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.set_kill_switch_state(uuid, text, text, text, text, text, jsonb) to service_role;
