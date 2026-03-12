# Mission Contract Notes

Required payload fields:

- `tenantId`
- `dprId`
- `runId`
- `taskId`
- `missionId`
- `status`

Security gate:

1. Ensure `tenantId` is valid UUID.
2. Resolve `IDENTITY.md` from local allowlisted DPR directory.
3. Parse `TENANT_ID` from agent identity file.
4. Reject and emit security exception when IDs differ.
