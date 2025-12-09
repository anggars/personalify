declare const process: { env: { [key: string]: string | undefined } };
export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url.searchParams.get('mode') === 'data') {
    const start = Date.now();
    let status = 'DOWN';

    if (UPSTASH_URL && UPSTASH_TOKEN) {
      try {
        const r = await fetch(`${UPSTASH_URL}/ping`, { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } });
        status = r.ok ? 'HEALTHY' : 'ERROR';
      } catch { status = 'DOWN'; }
    }

    const latency = Date.now() - start;

    if (UPSTASH_URL && UPSTASH_TOKEN) {
      try {
        const logMsg = `[MONITOR] Heartbeat check: ${status} (${latency}ms)`;
        await fetch(UPSTASH_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(["RPUSH", "system:logs", logMsg]) 

        });

        await fetch(UPSTASH_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(["LTRIM", "system:logs", -50, -1])
        });
      } catch {}
    }

    return new Response(JSON.stringify({ status, latency, timestamp: new Date().toISOString() }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Live Monitor</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        :root { --bg: #121212; --card: #1e1e1e; --accent: #1db954; --shadow-inset: inset 6px 6px 14px #0f0f0f, inset -6px -6px 14px #2d2d2d; --shadow-out: 6px 6px 14px #0f0f0f, -6px -6px 14px #2d2d2d; }
        body { background: var(--bg); color: #fff; font-family: monospace; display: flex; flex-direction: column; align-items: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }

        .nav { display: flex; gap: 10px; margin-bottom: 30px; background: var(--card); padding: 10px; border-radius: 15px; box-shadow: var(--shadow-out); }
        .nav a { color: #888; text-decoration: none; padding: 8px 16px; border-radius: 10px; font-weight: bold; font-size: 0.9rem; transition: 0.3s; }
        .nav a:hover, .nav a.active { background: var(--bg); color: var(--accent); box-shadow: var(--shadow-inset); }

        .container { width: 100%; max-width: 700px; }
        .monitor { background: var(--card); padding: 2rem; border-radius: 25px; box-shadow: var(--shadow-inset); border: 1px solid #252525; }

        .screen {
          background: #000; height: 150px; border-radius: 15px; margin: 1.5rem 0; position: relative; overflow: hidden;
          box-shadow: inset 0 0 20px #000; border: 1px solid #333; display: flex; align-items: flex-end;
        }

        #graph { display: flex; align-items: flex-end; width: 100%; height: 100%; gap: 2px; padding: 0 5px; }
        .bar { background: var(--accent); width: 100%; transition: height 0.2s; opacity: 0.8; }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .stat { background: #121212; padding: 15px; border-radius: 15px; box-shadow: var(--shadow-inset); text-align: center; }
        .val { font-size: 1.5rem; font-weight: bold; color: var(--accent); margin-top: 5px; }
        .lbl { font-size: 0.7rem; color: #666; }
      </style>
    </head>
    <body>
      <div class="nav">
        <a href="/api/status">STATUS</a>
        <a href="/api/monitor" class="active">MONITOR</a>
        <a href="/api/cache">CACHE</a>
        <a href="/api/log">LOGS</a>
      </div>

      <div class="container">
        <div class="monitor">
          <h2 style="margin:0; text-align:center; color:#fff; letter-spacing:2px; border-bottom:1px solid #333; padding-bottom:15px;">
            REAL-TIME LATENCY <span style="color:var(--accent); font-size:0.6em; vertical-align:middle;">● LIVE</span>
          </h2>

          <div class="screen">
            <div id="graph">
              </div>
          </div>

          <div class="grid">
            <div class="stat"><div class="lbl">STATUS</div><div class="val" id="statusVal">INIT...</div></div>
            <div class="stat"><div class="lbl">CURRENT LATENCY</div><div class="val" id="latencyVal">0ms</div></div>
          </div>
        </div>
      </div>

      <script>
        const graph = document.getElementById('graph');
        const maxBars = 40;

        for(let i=0; i<maxBars; i++) {
          const bar = document.createElement('div');
          bar.className = 'bar';
          bar.style.height = '2px';
          graph.appendChild(bar);
        }

        async function update() {
          try {

            const res = await fetch('/api/monitor?mode=data');
            const data = await res.json();

            document.getElementById('statusVal').innerText = data.status;
            document.getElementById('latencyVal').innerText = data.latency + 'ms';

            const color = data.status === 'HEALTHY' ? '#1db954' : '#ff4444';
            document.getElementById('statusVal').style.color = color;
            document.getElementById('latencyVal').style.color = color;

            const bars = document.getElementsByClassName('bar');
            for(let i=0; i<maxBars-1; i++) {
              bars[i].style.height = bars[i+1].style.height;
              bars[i].style.backgroundColor = bars[i+1].style.backgroundColor;
            }

            let h = Math.min(data.latency * 2, 100); 
            if(h < 2) h = 2;

            bars[maxBars-1].style.height = h + '%';
            bars[maxBars-1].style.backgroundColor = color;

          } catch (e) {
            console.log("Fetch error", e);
          }
        }

        setInterval(update, 1500);
        update();
      </script>
    </body>
    </html>
  `;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}