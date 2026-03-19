import { afterEach, describe, expect, it, vi } from "vitest";
import { createLiNKskillsBridge } from "./linkskills.js";

const mockFetch = vi.fn();

describe("LiNKskills bridge", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  it("returns disabled bridge when API URL is missing", async () => {
    const bridge = createLiNKskillsBridge({});
    expect(bridge.enabled).toBe(false);
    await expect(
      bridge.executeManagedRun({
        tenantId: "00000000-0000-0000-0000-000000000001",
        missionId: "5bb916ec-8f53-4424-b9fa-9969f1ab384f",
        runId: "LT-ALPHA-001",
        taskId: "TASK-001",
        dprId: "INT-MNG-260311-0004-MARK",
        capabilityId: "lead-engineer",
        inputPayload: {},
        contextRefs: []
      })
    ).rejects.toThrow("LiNKskills API is not configured");
  });

  it("executes managed run flow through logic-engine API", async () => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch
      .mockResolvedValueOnce(
        makeResponse(200, {
          run_id: "run-0ad2f2196f0b",
          status: "awaiting_disclosure",
          next_action: "POST /v1/disclosures/issue",
          disclosure_required: true
        })
      )
      .mockResolvedValueOnce(
        makeResponse(200, {
          receipt_id: "rcpt-2a7f41f1d700",
          manifest_ref: "manifest-run-0ad2f2196f0b",
          expires_at: "2026-03-17T00:00:00.000Z",
          run_status: "completed",
          disclosure_token: "token"
        })
      )
      .mockResolvedValueOnce(makeResponse(200, { status: "completed" }))
      .mockResolvedValueOnce(makeResponse(200, { receipt_id: "rcpt-2a7f41f1d700" }));

    const bridge = createLiNKskillsBridge({
      apiUrl: "http://127.0.0.1:8080",
      apiToken: "test-internal-token",
      principalId: "linktrend-internal-agent",
      billingTrack: "track_1",
      ventureId: "linktrend_internal"
    });
    const result = await bridge.executeManagedRun({
      tenantId: "00000000-0000-0000-0000-000000000001",
      missionId: "5bb916ec-8f53-4424-b9fa-9969f1ab384f",
      runId: "LT-ALPHA-001",
      taskId: "TASK-001",
      dprId: "INT-MNG-260311-0004-MARK",
      capabilityId: "lead-engineer",
      inputPayload: {},
      contextRefs: []
    });

    expect(result).toEqual({
      linkskillsRunId: "run-0ad2f2196f0b",
      runStatus: "completed",
      receiptId: "rcpt-2a7f41f1d700",
      manifestRef: "manifest-run-0ad2f2196f0b",
      expiresAt: "2026-03-17T00:00:00.000Z"
    });
    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(mockFetch.mock.calls[0][0]).toContain("/v1/runs");
    expect(mockFetch.mock.calls[1][0]).toContain("/v1/disclosures/issue");
    const firstRequest = mockFetch.mock.calls[0][1] as RequestInit;
    const firstRequestPayload = JSON.parse(String(firstRequest.body));
    expect(firstRequestPayload).toMatchObject({
      principal_id: "linktrend-internal-agent",
      origin: "AIOS",
      billing_track: "track_1",
      venture_id: "linktrend_internal"
    });
  });
});

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}
