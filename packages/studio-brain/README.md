# Studio Brain (Supabase)

This package contains SQL migrations and RPC contracts for AIOS memory.

## Contract

- Schemas: `core`, `shared_memory`, `scratch_memory`
- RLS + tenant context enforcement on all tenant-scoped tables
- RPC-only access for agents (`SECURITY DEFINER`)
- Embeddings: `vector(768)` columns on domain tables

## Migration order

1. `0001_init.sql`

## Runtime notes

Application services must set tenant context before any RPC call:

```sql
set local app.current_tenant = '<tenant-uuid>';
```

Any call path without tenant context will fail.
