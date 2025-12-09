declare const process: { env: { [key: string]: string | undefined } };
export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  async function upstash(cmd: any[]) {
    if(!UPSTASH_URL || !UPSTASH_TOKEN) return null;
    const r = await fetch(UPSTASH_URL, {
      method: 'POST', headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd)
    });

    const logMsg = `[INFO] CACHE: ${cmd[0]} ${cmd[1] || ''}`;
    fetch(UPSTASH_URL, {
        method: 'POST', headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(["RPUSH", "system:logs", logMsg])
    }).catch(()=>{});

    return (await r.json()).result;
  }

  if (req.method === 'POST') {
    const body = await req.json();
    await upstash(["SET", key || 'test', body.value, "EX", (body.ttl||3600).toString()]);
    return new Response(JSON.stringify({status:'SET'}), {headers:{'Content-Type':'application/json'}});
  }
  if (req.method === 'GET' && key) {
    const data = await upstash(["GET", key]);
    return new Response(JSON.stringify({status:data?'HIT':'MISS', data}), {headers:{'Content-Type':'application/json'}});
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Cache</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="icon" href="https://assets.vercel.com/image/upload/front/favicon/vercel/favicon.ico">
      <style>

        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        :root { --accent: #1db954; --text: #ffffff; --text-muted: #888888; }

        * { box-sizing: border-box; }

        html {
          height: 100%;
          overflow-y: auto; 
        }

        body {
          margin: 0;
          background-color: #000000;
          font-family: 'Inter', -apple-system, sans-serif; 
          color: var(--text);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center; 
          overflow-y: visible;
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

        .badge { background: #000; padding: 4px 8px; border-radius: 6px; font-size: 0.7rem; border: 1px solid #333; color: var(--accent); }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px solid #222; padding-bottom: 10px; }
        .lbl { font-size: 0.8rem; color: var(--text-muted); }
        .val { font-weight: 600; font-size: 0.9rem; }

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
        <a href="/api/monitor" class="nav-a">Monitor</a>
        <a href="/api/cache" class="nav-a active">Cache</a>
        <a href="/api/log" class="nav-a">Logs</a>
      </div>

      <div class="card-section">
        <h2 style="margin-top:0; display:flex; justify-content:space-between; align-items:center;">
          Edge Cache <span class="badge">ACTIVE</span>
        </h2>

        <div style="margin-top: 30px;">
           <div class="info-row"><span class="lbl">PROTOCOL</span> <span class="val">HTTP/REST</span></div>
           <div class="info-row"><span class="lbl">DRIVER</span> <span class="val">Native Fetch</span></div>
           <div class="info-row"><span class="lbl">RUNTIME</span> <span class="val">Vercel Edge</span></div>
        </div>

        <div style="margin-top:20px; text-align:center; font-size:0.8rem; color:var(--text-muted); background:rgba(255,255,255,0.05); padding:10px; border-radius:10px;">
          Ready for Python Requests
        </div>
      </div>
    </body>
    </html>
  `;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}