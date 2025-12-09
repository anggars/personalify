declare const process: { env: { [key: string]: string | undefined } };
export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  async function redisCmd(cmd: any[]) {
    if(!UPSTASH_URL || !UPSTASH_TOKEN) return null;
    const r = await fetch(UPSTASH_URL, {
      method: 'POST', headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd)
    });
    return (await r.json()).result;
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();

      const logStr = `[${body.level || 'INFO'}] ${body.source || 'SYS'}: ${body.message} | ${new Date().toISOString().split('T')[1].split('.')[0]}`;

      await redisCmd(["RPUSH", "system:logs", logStr]);

      await redisCmd(["LTRIM", "system:logs", -100, -1]);

      return new Response('OK', {status: 200});
    } catch { return new Response('ERR', {status: 500}); }
  }

  if (url.searchParams.get('mode') === 'stream') {
    const logs = await redisCmd(["LRANGE", "system:logs", -50, -1]);
    return new Response(JSON.stringify(logs || []), { headers: {'Content-Type': 'application/json'} });
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>System Logs</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>

        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400&display=swap'); 

        :root { --glass-bg: rgba(255, 255, 255, 0.05); --glass-border: rgba(255, 255, 255, 0.1); --glass-blur: blur(20px); --accent: #1db954; --text: #ffffff; --text-muted: #b3b3b3; }
        body { margin: 0; background: radial-gradient(circle at top left, #1e1e1e, #000000); font-family: 'Inter', sans-serif; color: var(--text); display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; overflow: hidden; }

        .nav-pill { position: fixed; top: 20px; display: flex; gap: 5px; background: rgba(0, 0, 0, 0.3); backdrop-filter: var(--glass-blur); padding: 8px; border-radius: 50px; border: 1px solid var(--glass-border); z-index: 100; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .nav-a { color: var(--text-muted); text-decoration: none; padding: 8px 20px; border-radius: 30px; font-size: 0.85rem; font-weight: 600; transition: 0.3s; }
        .nav-a:hover { color: #fff; background: rgba(255,255,255,0.1); }
        .nav-a.active { background: var(--accent); color: #000; box-shadow: 0 0 15px rgba(29, 185, 84, 0.4); }

        .glass-terminal {
          width: 90%; max-width: 800px; height: 70vh;
          background: rgba(0, 0, 0, 0.6); 
          backdrop-filter: var(--glass-blur); border: 1px solid var(--glass-border); border-radius: 20px;
          padding: 20px; display: flex; flex-direction: column;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5); animation: floatUp 0.8s ease;
        }

        .term-header { display: flex; justify-content: space-between; padding-bottom: 15px; border-bottom: 1px solid #333; margin-bottom: 10px; font-size: 0.9rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }

        .log-area { flex-grow: 1; overflow-y: auto; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; padding-right: 10px; }

        .line { padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; gap: 10px; }
        .ts { color: #666; font-size: 0.75rem; min-width: 70px; }
        .msg { color: #ddd; }

        .lvl-INFO { color: #4facfe; }
        .lvl-WARN { color: #ffd200; }
        .lvl-ERROR { color: #ff4444; }
        .src { opacity: 0.6; font-size: 0.75rem; border: 1px solid #444; padding: 0 4px; border-radius: 4px; margin-right: 6px; }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

        @keyframes floatUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
      </style>
    </head>
    <body>
      <div class="nav-pill">
        <a href="/api/status" class="nav-a">Status</a>
        <a href="/api/monitor" class="nav-a">Monitor</a>
        <a href="/api/cache" class="nav-a">Cache</a>
        <a href="/api/log" class="nav-a active">Logs</a>
      </div>

      <div class="glass-terminal">
        <div class="term-header">
          <span>Console Stream</span>
          <span style="color:var(--accent)">● Live</span>
        </div>
        <div class="log-area" id="logs">
          <div class="line" style="color:#666">Initializing log stream connection...</div>
        </div>
      </div>

      <script>
        const container = document.getElementById('logs');
        async function fetchLogs() {
          try {
            const res = await fetch('/api/log?mode=stream');
            const logs = await res.json();

            if(logs.length) {
              container.innerHTML = '';
              logs.forEach(l => {

                const div = document.createElement('div');
                div.className = 'line';

                let color = '#ccc';
                if(l.includes('INFO')) color = '#4facfe';
                if(l.includes('WARN')) color = '#ffd200';
                if(l.includes('ERROR') || l.includes('FAIL')) color = '#ff4444';

                div.innerHTML = \`<span style="color:\${color}">\${l}</span>\`;
                container.appendChild(div);
              });
              container.scrollTop = container.scrollHeight;
            }
          } catch {}
        }
        setInterval(fetchLogs, 2000);
        fetchLogs();
      </script>
    </body>
    </html>
  `;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}