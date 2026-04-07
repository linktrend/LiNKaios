dpr_id: "INT-MNG-260311-0004-MARK"
functional_baseline: "MNG"
birth_date: "2026-03-17"
authorized_tenant_id: "00000000-0000-0000-0000-000000000001"
current_role: "Team Lead"
agent_type: "team_lead"
agency_persona_ref: "agency.team_lead"
persona_version: "v1"
persona_source_repo: "https://github.com/linktrend/link-agency-agents"
current_department: "Development"
integration_channels:
  slack: "#aios-teamlead"
  telegram: "disabled"
  webhook: "n8n://ingress/teamlead"
  email: "notifications@linktrend.ai"
permissions:
  can_approve_proposals: false
  can_restore_archives: false
  can_trigger_handover: true
  can_assign_tasks: true
