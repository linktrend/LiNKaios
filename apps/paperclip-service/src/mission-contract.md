# Mission Contract Notes

Required payload fields:

- `tenantId`
- `agentId`
- `runId`
- `taskId`
- `missionId`
- `status`
- `identityPath`

Security gate:

1. Ensure `tenantId` is valid UUID.
2. Parse `TENANT_ID` from agent identity file.
3. Reject and emit security exception when IDs differ.
