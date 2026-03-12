export function buildRunId(prefix: string = "run"): string {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const random = Math.random().toString(16).slice(2, 10);
  return `${prefix}_${timestamp}_${random}`;
}
