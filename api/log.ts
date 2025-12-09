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
      const time = new Date().toLocaleTimeString('en-GB', { hour12: false, timeZone: 'Asia/Jakarta' });
      const logStr = `[${body.level || 'INFO'}] ${body.source || 'SYS'}: ${body.message} | ${time}`;
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
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="icon" href="https://assets.vercel.com/image/upload/front/favicon/vercel/favicon.ico">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400&display=swap'); 

        :root { --accent: #1db954; --text: #ffffff; --text-muted: #888888; }

        * { box-sizing: border-box; }

        body { 
            margin: 0; 
            background: #000000; 
            font-family: 'Inter', sans-serif; 
            color: var(--text); 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            min-height: 100vh; 
            overflow-y: auto;
            padding: 80px 20px 40px 20px;
        }

        .nav-pill { 
            position: fixed; top: 20px; display: flex; gap: 5px; 
            background: #111; padding: 6px; border-radius: 50px; 
            border: 1px solid #333; z-index: 100; box-shadow: 0 4px 20px rgba(0,0,0,0.8);
            justify-content: center; flex-wrap: wrap;
        }
        .nav-a { color: var(--text-muted); text-decoration: none; padding: 8px 16px; border-radius: 30px; font-size: 0.8rem; font-weight: 600; transition: 0.2s; }
        .nav-a:hover { color: #fff; background: rgba(255,255,255,0.1); }
        .nav-a.active { background: var(--accent); color: #000; }

        .glass-terminal {
          width: 100%; 
          max-width: 800px; 
          height: 70vh;
          background: #111; 
          border: 1px solid #333; 
          border-radius: 16px;
          padding: 20px; 
          display: flex; 
          flex-direction: column;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5); 
          animation: fadeIn 0.5s ease;
        }

        .term-header { 
          display: flex; justify-content: space-between; padding-bottom: 15px; 
          border-bottom: 1px solid #222; margin-bottom: 10px; 
          font-size: 0.8rem; color: var(--text-muted); font-weight: 700; 
          text-transform: uppercase; letter-spacing: 1px; 
        }

        .log-area { 
          flex-grow: 1; overflow-y: auto; 
          font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; 
        }

        .line { 
          padding: 4px 0; 
          border-bottom: 1px solid #222; 
          display: flex; flex-direction: row; gap: 10px; 
          line-height: 1.4;
        }

        .ts { 
          color: #555; 
          min-width: 65px; 
          text-align: right; 
          font-size: 0.75rem;
          flex-shrink: 0;
        }

        .sep { color: #333; }

        .msg { color: #ccc; word-break: break-all; white-space: pre-wrap; }

        .lvl-INFO { color: #4facfe; }
        .lvl-WARN { color: #ffd200; }
        .lvl-ERROR { color: #ff4444; }
        .lvl-AUTH { color: #1db954; font-weight:bold; }
        .lvl-SEARCH { color: #ff00de; }
        .lvl-LYRICS { color: #00e5ff; }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 768px) {
            body { padding: 90px 10px 20px 10px; }
            .glass-terminal { height: 65vh; padding: 15px; }
            .nav-pill { width: 90%; justify-content: space-evenly; }
            .nav-a { padding: 6px 10px; font-size: 0.75rem; }
            .line { flex-direction: column; gap: 2px; } 
            .ts { text-align: left; }
            .sep { display: none; }
        }
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
          <span>System Stream</span>
          <span style="color:var(--accent)">Live</span>
        </div>
        <div class="log-area" id="logs">
          <div class="line" style="color:#666">Waiting for logs...</div>
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
              logs.forEach(rawLog => {
                let time = '--:--:--';
                let content = rawLog;

                if (rawLog.includes('|')) {
                    const parts = rawLog.split('|');
                    const potentialTime = parts[parts.length - 1].trim();
                    if (potentialTime.includes(':')) {
                        time = potentialTime;
                        content = parts.slice(0, -1).join('|').trim();
                    }
                }

                let colorClass = '';
                if(content.includes('INFO')) colorClass = 'lvl-INFO';
                if(content.includes('WARN')) colorClass = 'lvl-WARN';
                if(content.includes('ERROR') || content.includes('FAIL')) colorClass = 'lvl-ERROR';
                if(content.includes('AUTH')) colorClass = 'lvl-AUTH';
                if(content.includes('SEARCH')) colorClass = 'lvl-SEARCH';
                if(content.includes('LYRICS')) colorClass = 'lvl-LYRICS';

                const div = document.createElement('div');
                div.className = 'line';
                div.innerHTML = \`
                  <span class="ts">\${time}</span>
                  <span class="sep">|</span>
                  <span class="msg \${colorClass}">\${content}</span>
                \`;
                container.appendChild(div);
              });
              container.scrollTop = container.scrollHeight;
            }
          } catch(e) {}
        }

        setInterval(fetchLogs, 2000);
        fetchLogs();
      </script>
    </body>
    </html>
  `;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}