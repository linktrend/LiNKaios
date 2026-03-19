import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createAiosEventBus } from "./nats.js";

describe("NATS event bus", () => {
  it("returns disabled/noop bus when URL is not configured", async () => {
    const bus = await createAiosEventBus(undefined);

    expect(bus.enabled).toBe(false);
    expect(bus.health()).toMatchObject({
      enabled: false,
      mode: "disabled",
      streamReady: false,
      publishAckMode: "none"
    });

    await expect(
      bus.publish({
        eventId: randomUUID(),
        eventType: "aios.task.created",
        occurredAt: new Date().toISOString(),
        schemaVersion: "1.0",
        tenantId: "00000000-0000-0000-0000-000000000001",
        missionId: randomUUID(),
        runId: "RUN-LOCAL-0001",
        taskId: "TASK-0001",
        fromDprId: "INT-MNG-260311-0001-LISA",
        toDprId: "INT-MNG-260311-0004-MARK",
        correlationId: "RUN-LOCAL-0001:TASK-0001",
        idempotencyKey: "aios.task.created:RUN-LOCAL-0001:TASK-0001",
        payload: { summary: "noop publish test" }
      })
    ).resolves.toBeUndefined();
  });
});
