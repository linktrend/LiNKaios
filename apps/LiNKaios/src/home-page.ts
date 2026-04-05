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
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border: 1px solid var(--border); border-radius: 12px; padding: 12px 16px;
        background: rgba(17, 24, 39, 0.7);
      }
      .brand-title {
        font-size: 24px;
        line-height: 1.1;
        margin: 0;
        font-weight: 800;
      }
      .brand-subtitle {
        margin: 4px 0 0;
        font-size: 13px;
        color: var(--muted);
      }
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
      .status-label {
        font-size: 12px;
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
      .status.partial .dot {
        background: #f59e0b;
        box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.18);
      }
      .status.disconnected .dot {
        background: #ef4444;
        box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.15);
      }
      .logout {
        text-decoration: none;
        color: #fecaca;
        border: 1px solid #7f1d1d;
        padding: 8px 12px;
        border-radius: 10px;
        background: rgba(127, 29, 29, 0.35);
        font-size: 14px;
      }
      .logout:hover { border-color: #ef4444; color: #fee2e2; background: rgba(127, 29, 29, 0.6); }
      .section { margin-top: 18px; }
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
        <div>
          <h1 class="brand-title"><span class="accent">LiNK</span>aios Home</h1>
          <p class="brand-subtitle">LiNKtrend Ai Operating System</p>
        </div>
        <div class="status-block">
          <span class="status-label">System Status</span>
          <div id="cp-status" class="status disconnected">
            <span class="dot" aria-hidden="true"></span>
            <span id="cp-status-text">disconnected</span>
          </div>
          <a class="logout" href="${links.logout}">Logout</a>
        </div>
      </header>

      <section class="section grid">
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
        const checks = [
          "/health/linkaios",
          "${links.operations}",
          "${links.linkskills}",
          "${links.linkbrain}",
          "${links.agentUi}"
        ];

        const ping = async (url) => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 2500);
          try {
            const response = await fetch(url, { signal: controller.signal, credentials: "same-origin" });
            return response.ok;
          } catch {
            return false;
          } finally {
            clearTimeout(timeout);
          }
        };

        Promise.all(checks.map((url) => ping(url))).then((results) => {
          const healthyCount = results.filter(Boolean).length;
          const totalCount = results.length;

          if (!statusNode || !statusTextNode) return;
          statusNode.classList.remove("connected", "partial", "disconnected");

          if (healthyCount === totalCount) {
            statusNode.classList.add("connected");
            statusTextNode.textContent = "all systems healthy";
            return;
          }

          if (healthyCount === 0) {
            statusNode.classList.add("disconnected");
            statusTextNode.textContent = "all systems down";
            return;
          }

          statusNode.classList.add("partial");
          statusTextNode.textContent = "some systems healthy";
        }).catch(() => {
          if (!statusNode || !statusTextNode) return;
          statusNode.classList.remove("connected", "partial");
          statusNode.classList.add("disconnected");
          statusTextNode.textContent = "all systems down";
        });
      })();
    </script>
  </body>
</html>`;
}
