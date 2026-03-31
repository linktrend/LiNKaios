# LiNKbrain (Supabase)

This package contains SQL migrations and RPC contracts for AIOS memory.

## Contract

- Schemas: `lb_core`, `lb_shared`, `lb_scratch`
- RLS + tenant context enforcement on all tenant-scoped tables
- RPC-only access for agents (`SECURITY DEFINER`)
- Embeddings: `vector(768)` columns on domain tables

## Migration order

1. `0001_init.sql`
2. `0002_persona_policy_centralization.sql`

## Naming standard for new migrations

Use timestamped names going forward:

- `YYYYMMDD_HHMMSS_lb_<change>.sql`

## Runtime notes

Application services must set tenant context before any RPC call:

```sql
set local app.current_tenant = '<tenant-uuid>';
```

Any call path without tenant context will fail.
