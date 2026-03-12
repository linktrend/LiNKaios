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
    throw new Error(`LiNKboard request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { synthesis?: string };
  if (!payload.synthesis) {
    throw new Error("LiNKboard response missing synthesis");
  }

  return payload.synthesis;
}
