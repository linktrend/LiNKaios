type LiNKaiosHomeOptions = {
  companyPrefix: string;
  host?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderLiNKaiosHomePage(options: LiNKaiosHomeOptions): string {
  const companyPrefix = options.companyPrefix.trim();
  const safePrefix = escapeHtml(companyPrefix);
  const safeHost = escapeHtml(options.host?.trim() || "LiNKtrend Control Plane");
  const base = `/${encodeURIComponent(companyPrefix)}`;

  const links = {
    home: `${base}/home`,
    operations: `${base}/dashboard`,
    linkskills: `${base}/linkskills`,
    linkbrain: `${base}/linkbrain`,
    agentUi: `${base}/agent-ui`
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LiNKaios Home</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #0b0f1a;
        --card: #111827;
        --muted: #9ca3af;
        --text: #f9fafb;
        --accent: #f27f28;
        --border: #1f2937;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: radial-gradient(1200px 600px at 20% -10%, #1f2937 0%, var(--bg) 60%);
        color: var(--text);
      }
      .wrap { max-width: 1100px; margin: 0 auto; padding: 24px; }
      .topbar {
        display: flex; align-items: center; justify-content: space-between;
        border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px;
        background: rgba(17, 24, 39, 0.7);
      }
      .brand { font-weight: 700; letter-spacing: 0.3px; }
      .host { color: var(--muted); font-size: 13px; }
      .tabs { margin-top: 16px; display: flex; gap: 10px; flex-wrap: wrap; }
      .tab {
        text-decoration: none; color: var(--text); border: 1px solid var(--border);
        padding: 8px 12px; border-radius: 10px; background: rgba(17, 24, 39, 0.7); font-size: 14px;
      }
      .tab.active { border-color: var(--accent); color: var(--accent); }
      h1 { margin: 28px 0 6px; font-size: 34px; }
      p.lead { margin: 0 0 24px; color: var(--muted); }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
      }
      .card {
        display: block;
        text-decoration: none;
        color: var(--text);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 16px;
        background: rgba(17, 24, 39, 0.8);
        min-height: 140px;
      }
      .card:hover { border-color: var(--accent); transform: translateY(-1px); transition: 120ms ease; }
      .card h2 { margin: 0 0 8px; font-size: 18px; }
      .card p { margin: 0; color: var(--muted); line-height: 1.4; font-size: 14px; }
      .accent { color: var(--accent); }
    </style>
  </head>
  <body>
    <main class="wrap">
      <header class="topbar">
        <div class="brand">LiNKaios</div>
        <div class="host">${safeHost}</div>
      </header>

      <nav class="tabs" aria-label="LiNKaios navigation">
        <a class="tab active" href="${links.home}">Home</a>
        <a class="tab" href="${links.operations}">Operations</a>
        <a class="tab" href="${links.linkskills}">LiNKskills</a>
        <a class="tab" href="${links.linkbrain}">LiNKbrain</a>
        <a class="tab" href="${links.agentUi}">Agent UI</a>
      </nav>

      <section>
        <h1><span class="accent">LiNK</span>aios Home</h1>
        <p class="lead">Unified orchestration surface for company <strong>${safePrefix}</strong>.</p>
      </section>

      <section class="grid">
        <a class="card" href="${links.operations}">
          <h2>Operations</h2>
          <p>Open Paperclip workspace for missions, inbox, issues, routines, goals, and company operations.</p>
        </a>
        <a class="card" href="${links.linkskills}">
          <h2>LiNKskills</h2>
          <p>Manage capability routing and per-agent skill controls.</p>
        </a>
        <a class="card" href="${links.linkbrain}">
          <h2>LiNKbrain</h2>
          <p>View operational memory and governance data.</p>
        </a>
        <a class="card" href="${links.agentUi}">
          <h2>Agent UI</h2>
          <p>Open runtime agent interfaces such as OpenClaw.</p>
        </a>
      </section>
    </main>
  </body>
</html>`;
}

