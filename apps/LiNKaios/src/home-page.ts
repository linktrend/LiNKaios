type LiNKaiosHomeOptions = {
  companyPrefix: string;
};

export function renderLiNKaiosHomePage(options: LiNKaiosHomeOptions): string {
  const companyPrefix = options.companyPrefix.trim();
  const base = `/${encodeURIComponent(companyPrefix)}`;

  const links = {
    home: `${base}/home`,
    operations: `${base}/dashboard`,
    linkskills: `${base}/linkskills`,
    linkbrain: `${base}/linkbrain`,
    agentUi: `${base}/agent-ui`,
    logout: "/oauth2/sign_out"
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
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px;
        background: rgba(17, 24, 39, 0.7);
      }
      .brand { font-weight: 700; letter-spacing: 0.3px; margin-top: 2px; }
      .status-block {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
      }
      .status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--muted);
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: #ef4444;
        box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.15);
      }
      .status.connected .dot {
        background: #22c55e;
        box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.15);
      }
      .status.disconnected .dot {
        background: #ef4444;
        box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.15);
      }
      .logout {
        text-decoration: none; color: var(--text); border: 1px solid var(--border);
        padding: 8px 12px; border-radius: 10px; background: rgba(17, 24, 39, 0.7); font-size: 14px;
      }
      .logout:hover { border-color: var(--accent); color: var(--accent); }
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
        <div class="status-block">
          <div id="cp-status" class="status disconnected">
            <span class="dot" aria-hidden="true"></span>
            <span id="cp-status-text">disconnected</span>
          </div>
          <a class="logout" href="${links.logout}">Logout</a>
        </div>
      </header>

      <section>
        <h1><span class="accent">LiNK</span>aios Home</h1>
        <p class="lead">LiNKtrend Ai Operating System</p>
      </section>

      <section class="grid">
        <a class="card" href="${links.operations}">
          <h2>Operations</h2>
          <p>Open the company workspace for missions, inbox, issues, routines, goals, and company operations.</p>
        </a>
        <a class="card" href="${links.linkskills}">
          <h2>LiNKskills</h2>
          <p>Manage all agents capability and skill controls.</p>
        </a>
        <a class="card" href="${links.linkbrain}">
          <h2>LiNKbrain</h2>
          <p>View operational shared memory and governance data.</p>
        </a>
        <a class="card" href="${links.agentUi}">
          <h2>Agents UI</h2>
          <p>Open runtime agent interfaces.</p>
        </a>
      </section>
    </main>
    <script>
      (() => {
        const statusNode = document.getElementById("cp-status");
        const statusTextNode = document.getElementById("cp-status-text");
        const healthUrl = "/health/linkaios";
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        fetch(healthUrl, { signal: controller.signal, credentials: "same-origin" })
          .then((response) => {
            if (!response.ok) throw new Error("health check failed");
            if (statusNode) {
              statusNode.classList.remove("disconnected");
              statusNode.classList.add("connected");
            }
            if (statusTextNode) statusTextNode.textContent = "connected";
          })
          .catch(() => {
            if (statusNode) {
              statusNode.classList.remove("connected");
              statusNode.classList.add("disconnected");
            }
            if (statusTextNode) statusTextNode.textContent = "disconnected";
          })
          .finally(() => clearTimeout(timeout));
      })();
    </script>
  </body>
</html>`;
}
