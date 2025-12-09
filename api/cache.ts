declare const process: { env: { [key: string]: string | undefined } };
export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  async function upstash(cmd: any[], logDetails: string) {
    if(!UPSTASH_URL || !UPSTASH_TOKEN) return null;

    const res = await fetch(UPSTASH_URL, {
      method: 'POST', headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd)
    });

    const logMsg = `[CACHE] ${logDetails} | Time: ${new Date().toISOString().split('T')[1].split('.')[0]}`;
    fetch(UPSTASH_URL, {
      method: 'POST', headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(["RPUSH", "system:logs", logMsg])
    }).catch(()=>{}); 

    return (await res.json()).result;
  }

  if (req.method === 'POST') {
    const body = await req.json();
    await upstash(["SET", key || 'test', body.value, "EX", (body.ttl||3600).toString()], `SET key=${key}`);
    return new Response(JSON.stringify({status:'SET'}), {headers:{'Content-Type':'application/json'}});
  }
  if (req.method === 'GET' && key) {
    const data = await upstash(["GET", key], `GET key=${key}`);
    return new Response(JSON.stringify({status:data?'HIT':'MISS', data}), {headers:{'Content-Type':'application/json'}});
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Cache Node</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        :root { --bg: #121212; --card: #1e1e1e; --accent: #1db954; --shadow-inset: inset 6px 6px 14px #0f0f0f, inset -6px -6px 14px #2d2d2d; --shadow-out: 6px 6px 14px #0f0f0f, -6px -6px 14px #2d2d2d; }
        body { background: var(--bg); color: #e0e0e0; font-family: monospace; display: flex; flex-direction: column; align-items: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }

        .nav { display: flex; gap: 10px; margin-bottom: 30px; background: var(--card); padding: 10px; border-radius: 15px; box-shadow: var(--shadow-out); }
        .nav a { color: #888; text-decoration: none; padding: 8px 16px; border-radius: 10px; font-weight: bold; font-size: 0.9rem; transition: 0.3s; }
        .nav a:hover, .nav a.active { background: var(--bg); color: var(--accent); box-shadow: var(--shadow-inset); }

        .container { width: 100%; max-width: 700px; }
        .box { background: var(--card); padding: 2.5rem; border-radius: 25px; box-shadow: var(--shadow-inset); border: 1px solid #252525; }
        h2 { margin-top: 0; border-bottom: 2px solid #252525; padding-bottom: 15px; color: var(--accent); text-transform: uppercase; display: flex; justify-content: space-between; }
        .badge { background: #000; font-size: 0.7rem; padding: 5px 10px; border-radius: 5px; color: #fff; border: 1px solid #333; }
        .info { background: #121212; padding: 15px; border-radius: 15px; box-shadow: var(--shadow-inset); margin-top: 20px; color: #888; font-size: 0.9rem; }
        .key-val { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .val { color: var(--accent); font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="nav">
        <a href="/api/status">STATUS</a>
        <a href="/api/monitor">MONITOR</a>
        <a href="/api/cache" class="active">CACHE</a>
        <a href="/api/log">LOGS</a>
      </div>

      <div class="container">
        <div class="box">
          <h2>Edge Cache <span class="badge">ACTIVE</span></h2>
          <div class="info">
            <div class="key-val"><span>Protocol</span> <span class="val">REST / HTTP</span></div>
            <div class="key-val"><span>Driver</span> <span class="val">Native Fetch</span></div>
            <div class="key-val"><span>Runtime</span> <span class="val">Vercel Edge</span></div>
            <div style="margin-top: 15px; border-top: 1px solid #222; padding-top: 10px; text-align: center; font-size: 0.8rem;">
              Listening for Python Backend Requests...
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}