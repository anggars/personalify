export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const city = req.headers.get('x-vercel-ip-city') || 'Unknown City';
  const region = req.headers.get('x-vercel-ip-country-region') || 'Global';
  const requestId = req.headers.get('x-vercel-id') || 'dev-mode';
  const now = new Date();

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>System Status</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        :root { --bg: #121212; --text: #e0e0e0; --accent: #1db954; --card-bg: #1e1e1e; --shadow-inset: inset 6px 6px 14px #0f0f0f, inset -6px -6px 14px #2d2d2d; --shadow-out: 6px 6px 14px #0f0f0f, -6px -6px 14px #2d2d2d; }
        body { background: var(--bg); color: var(--text); font-family: monospace; display: flex; flex-direction: column; align-items: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }

        .nav { display: flex; gap: 10px; margin-bottom: 30px; background: var(--card-bg); padding: 10px; border-radius: 15px; box-shadow: var(--shadow-out); }
        .nav a { color: #888; text-decoration: none; padding: 8px 16px; border-radius: 10px; font-weight: bold; font-size: 0.9rem; transition: 0.3s; }
        .nav a:hover, .nav a.active { background: var(--bg); color: var(--accent); box-shadow: var(--shadow-inset); }

        .container { width: 100%; max-width: 700px; }
        .box { background: var(--card-bg); padding: 2.5rem; border-radius: 25px; box-shadow: var(--shadow-inset); border: 1px solid #252525; }

        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 2px solid #252525; padding-bottom: 15px; }
        h1 { margin: 0; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 2px; color: var(--accent); }
        .pill { background: var(--bg); padding: 5px 15px; border-radius: 20px; font-size: 0.75rem; box-shadow: var(--shadow-inset); display: flex; align-items: center; gap: 8px; font-weight: bold; color: var(--accent); }
        .dot { width: 8px; height: 8px; background: var(--accent); border-radius: 50%; box-shadow: 0 0 8px var(--accent); animation: pulse 2s infinite; }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .metric { background: var(--bg); padding: 15px; border-radius: 15px; box-shadow: var(--shadow-inset); text-align: center; }
        .label { font-size: 0.7rem; color: #888; text-transform: uppercase; margin-bottom: 5px; }
        .val { font-size: 0.95rem; font-weight: 600; }

        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
      </style>
    </head>
    <body>
      <div class="nav">
        <a href="/api/status" class="active">STATUS</a>
        <a href="/api/monitor">MONITOR</a>
        <a href="/api/cache">CACHE</a>
        <a href="/api/log">LOGS</a>
      </div>

      <div class="container">
        <div class="box">
          <div class="header">
            <h1>System Status</h1>
            <div class="pill"><div class="dot"></div> OPERATIONAL</div>
          </div>
          <div class="grid">
            <div class="metric">
              <div class="label">Region</div>
              <div class="val">${region}</div>
            </div>
            <div class="metric">
              <div class="label">City</div>
              <div class="val">${city}</div>
            </div>
            <div class="metric" style="grid-column: span 2;">
              <div class="label">Server Time</div>
              <div class="val" style="color: var(--accent); font-size: 1.1rem;">${now.toLocaleTimeString()}</div>
              <div class="label" style="margin-top:4px;">${now.toLocaleDateString()}</div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}