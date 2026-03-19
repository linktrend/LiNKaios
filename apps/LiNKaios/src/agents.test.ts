import { describe, expect, it } from "vitest";
import {
  discoverInternalAgents,
  evaluateAgencyReadiness,
  evaluateOperationalCertification
} from "./agents.js";

describe("agent readiness", () => {
  it("includes the locked initial MVO roster", () => {
    const roster = discoverInternalAgents();

    expect(roster.managers).toEqual(
      expect.arrayContaining([
        "INT-MNG-260311-0001-LISA",
        "INT-MNG-260311-0002-ERIC",
        "INT-MNG-260311-0003-JOHN",
        "INT-MNG-260311-0004-MARK"
      ])
    );

    expect(roster.workers).toEqual(
      expect.arrayContaining([
        "INT-EXE-260311-0004-SARAH",
        "INT-EXE-260311-0005-MIKE",
        "INT-EXE-260311-0006-KATE",
        "INT-EXE-260311-0007-ALEX"
      ])
    );
  });

  it("passes agency and operational readiness for the current MVO roster", () => {
    const agency = evaluateAgencyReadiness();
    const operational = evaluateOperationalCertification();

    expect(agency.summary.totalAgents).toBe(8);
    expect(agency.summary.readyAgents).toBe(8);
    expect(agency.summary.personaRefMismatch).toBe(0);
    expect(agency.summary.personaSourceMismatch).toBe(0);

    expect(operational.summary.totalAgents).toBe(8);
    expect(operational.summary.readyAgents).toBe(8);
    expect(operational.summary.failedAgents).toBe(0);
    expect(operational.summary.initialRosterReady).toBe(true);
    expect(operational.summary.missionIntakeDryRunReady).toBe(true);
    expect(operational.summary.handoffDryRunReady).toBe(true);
  });
});
