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
    return new Response(JSON.stringify({ status, latency }), { headers: {'Content-Type': 'application/json'} });
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Monitor</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="icon" href="https://assets.vercel.com/image/upload/front/favicon/vercel/favicon.ico">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');

        :root { --accent: #1db954; --text: #ffffff; --text-muted: #888888; }

        * { box-sizing: border-box; }

        body {
          margin: 0;
          background-color: #000000;
          font-family: 'Inter', -apple-system, sans-serif; 
          color: var(--text);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center; 
          min-height: 100vh;
          overflow-y: hidden;
          overflow-x: hidden;
          padding: 60px 20px 20px 20px; 
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

        .card-section { 
            width: 100%; 
            max-width: 480px; 
            background: #111; 
            border: 1px solid #333; 
            border-radius: 16px; 
            padding: 30px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.5); 
            animation: scaleUp 0.4s ease;
            margin-top: 40px;
        }

        .screen { 
            background: #000; 
            height: 140px; 
            border-radius: 12px; 
            margin: 20px 0; 
            position: relative; 
            overflow: hidden; 
            border: 1px solid #333; 
            display: flex; 
            align-items: flex-end; 
            padding: 0 5px; 
            gap: 2px; 
        }
        .bar { flex: 1; background: var(--accent); opacity: 0.8; border-radius: 2px 2px 0 0; transition: height 0.2s ease; min-width: 2px; }

        .stat-row { display: flex; justify-content: space-between; gap: 15px; margin-top: 10px; }
        .stat-item { flex: 1; text-align: center; background: #1a1a1a; padding: 15px; border-radius: 12px; border: 1px solid #2a2a2a; }

        .lbl { font-size: 0.7rem; color: var(--text-muted); font-weight: 700; margin-bottom: 5px; }
        .val { font-size: 1.1rem; font-weight: 700; }

        @keyframes scaleUp { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

        @media (max-width: 768px) {
            body { padding: 15px; }
            .card-section { padding: 20px; }
            .nav-pill { width: 90%; justify-content: space-evenly; }
            .nav-a { padding: 6px 10px; font-size: 0.75rem; }
        }
      </style>
    </head>
    <body>
      <div class="nav-pill">
        <a href="/api/status" class="nav-a">Status</a>
        <a href="/api/monitor" class="nav-a active">Monitor</a>
        <a href="/api/cache" class="nav-a">Cache</a>
        <a href="/api/log" class="nav-a">Logs</a>
      </div>

      <div class="card-section">
        <h2 style="margin:0; text-align:center; font-weight:800; font-size:1.2rem;">Live Latency</h2>
        <div class="screen" id="chart"></div>
        <div class="stat-row">
           <div class="stat-item">
             <div class="lbl">STATUS</div>
             <div class="val" id="status" style="color:var(--accent)">INIT</div>
           </div>
           <div class="stat-item">
             <div class="lbl">LATENCY</div>
             <div class="val" id="lat">0ms</div>
           </div>
        </div>
      </div>

      <script>
        const chart = document.getElementById('chart');
        const bars = [];
        for(let i=0; i<30; i++) {
          const b = document.createElement('div'); b.className='bar'; b.style.height='2%'; chart.appendChild(b); bars.push(b);
        }
        async function loop() {
          try {
            const res = await fetch('/api/monitor?mode=data');
            const data = await res.json();
            document.getElementById('status').innerText = data.status;
            document.getElementById('lat').innerText = data.latency + 'ms';

            for(let i=0; i<29; i++) { bars[i].style.height = bars[i+1].style.height; }
            let h = Math.min(data.latency * 2, 100);
            if(h<5) h=5;
            bars[29].style.height = h + '%';
            bars[29].style.background = data.status==='HEALTHY' ? '#1db954' : '#ff4444';
          } catch {}
        }
        setInterval(loop, 1000);
      </script>
    </body>
    </html>
  `;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}