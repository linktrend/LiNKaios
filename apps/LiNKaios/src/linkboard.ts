export type CouncilInput = {
  missionId: string;
  tenantId: string;
  dprId: string;
  goal: string;
};

export async function requestCouncilSynthesis(
  linkboardUrl: string | undefined,
  input: CouncilInput
): Promise<string | null> {
  if (!linkboardUrl) {
    return null;
  }

  try {
    const response = await fetch(linkboardUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mission_id: input.missionId,
        tenant_id: input.tenantId,
        dpr_id: input.dprId,
        goal: input.goal
      })
    });

    if (!response.ok) {
      console.warn(`linkboard_synthesis_unavailable status=${response.status}`);
      return null;
    }

    const payload = (await response.json()) as { synthesis?: string };
    if (!payload.synthesis) {
      console.warn("linkboard_synthesis_unavailable missing_synthesis");
      return null;
    }

    return payload.synthesis;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    console.warn(`linkboard_synthesis_unavailable reason=${reason}`);
    return null;
  }
}
