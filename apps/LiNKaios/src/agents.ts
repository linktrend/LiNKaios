import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type AgentDiscovery = {
  managers: string[];
  workers: string[];
};

const INTERNAL_MANAGERS_DIR = join(process.cwd(), "agents", "internal", "managers");
const INTERNAL_WORKERS_DIR = join(process.cwd(), "agents", "internal", "workers");

function listDprDirectories(path: string): string[] {
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function discoverInternalAgents(): AgentDiscovery {
  return {
    managers: listDprDirectories(INTERNAL_MANAGERS_DIR),
    workers: listDprDirectories(INTERNAL_WORKERS_DIR)
  };
}

export function resolveIdentityPath(dprId: string): string {
  const isDprLike = /^[A-Z]{3}-[A-Z]{3}-\d{6}-[A-F0-9]{4}-[A-Z0-9-]+$/.test(dprId);
  if (!isDprLike) {
    throw new Error(`Invalid DPR identifier format: ${dprId}`);
  }

  const managerIdentity = join(INTERNAL_MANAGERS_DIR, dprId, "IDENTITY.md");
  if (existsSync(managerIdentity)) {
    return managerIdentity;
  }

  const workerIdentity = join(INTERNAL_WORKERS_DIR, dprId, "IDENTITY.md");
  if (existsSync(workerIdentity)) {
    return workerIdentity;
  }

  throw new Error(`Unknown internal agent DPR identifier: ${dprId}`);
}
