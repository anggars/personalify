declare const process: { env: { [key: string]: string | undefined } };
export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url.searchParams.get('mode') === 'stream') {
    if(!UPSTASH_URL || !UPSTASH_TOKEN) return new Response(JSON.stringify([]));

    const res = await fetch(UPSTASH_URL, {
      method: 'POST', headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(["LRANGE", "system:logs", -20, -1])
    });
    const data = await res.json();
    return new Response(JSON.stringify(data.result || []), { headers: {'Content-Type': 'application/json'} });
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>System Logs</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        :root { --bg: #121212; --card: #1e1e1e; --accent: #1db954; --shadow-inset: inset 6px 6px 14px #0f0f0f, inset -6px -6px 14px #2d2d2d; --shadow-out: 6px 6px 14px #0f0f0f, -6px -6px 14px #2d2d2d; }
        body { background: var(--bg); color: #ccc; font-family: 'Courier New', monospace; display: flex; flex-direction: column; align-items: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }

        .nav { display: flex; gap: 10px; margin-bottom: 30px; background: var(--card); padding: 10px; border-radius: 15px; box-shadow: var(--shadow-out); }
        .nav a { color: #888; text-decoration: none; padding: 8px 16px; border-radius: 10px; font-weight: bold; font-size: 0.9rem; transition: 0.3s; }
        .nav a:hover, .nav a.active { background: var(--bg); color: var(--accent); box-shadow: var(--shadow-inset); }

        .container { width: 100%; max-width: 700px; height: 70vh; }
        .term {
          background: var(--card); height: 100%; border-radius: 20px; padding: 20px;
          box-shadow: var(--shadow-inset); border: 1px solid #252525; overflow-y: auto; display: flex; flex-direction: column;
        }
        .header { color: var(--accent); font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 15px; letter-spacing: 1px; display:flex; justify-content:space-between; }
        .log-area { flex-grow: 1; overflow-y: auto; }
        .line { padding: 4px 0; border-bottom: 1px solid #222; font-size: 0.85rem; }
        .line:last-child { animation: highlight 1s ease; }
        @keyframes highlight { from { background: #111; } to { background: transparent; } }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
      </style>
    </head>
    <body>
      <div class="nav">
        <a href="/api/status">STATUS</a>
        <a href="/api/monitor">MONITOR</a>
        <a href="/api/cache">CACHE</a>
        <a href="/api/log" class="active">LOGS</a>
      </div>

      <div class="container">
        <div class="term">
          <div class="header">
            <span>>> SYSTEM LOGS</span>
            <span style="font-size:0.8rem; opacity:0.7">LIVE STREAM</span>
          </div>
          <div class="log-area" id="logs">
            <div class="line" style="color:#666">Connecting to log stream...</div>
          </div>
        </div>
      </div>

      <script>
        const logContainer = document.getElementById('logs');

        async function fetchLogs() {
          try {
            const res = await fetch('/api/log?mode=stream');
            const logs = await res.json();

            if(logs.length > 0) {

              logContainer.innerHTML = '';
              logs.forEach(log => {
                const div = document.createElement('div');
                div.className = 'line';
                div.innerText = log;

                if(log.includes('ERROR') || log.includes('DOWN')) div.style.color = '#ff4444';
                if(log.includes('CACHE')) div.style.color = '#1db954';
                if(log.includes('MONITOR')) div.style.color = '#ffb02e';
                logContainer.appendChild(div);
              });

              logContainer.scrollTop = logContainer.scrollHeight;
            } else {
              logContainer.innerHTML = '<div class="line" style="color:#666">No logs found in Redis yet...</div>';
            }
          } catch(e) { console.error(e); }
        }

        setInterval(fetchLogs, 3000);
        fetchLogs();
      </script>
    </body>
    </html>
  `;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}