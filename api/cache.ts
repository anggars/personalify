declare const process: { env: { [key: string]: string | undefined } };

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  
  const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  async function upstashRequest(command: any[]) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
    try {
      const res = await fetch(UPSTASH_URL, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${UPSTASH_TOKEN}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(command)
      });
      const data: any = await res.json();
      return data.result;
    } catch { return null; }
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      await upstashRequest(["SET", key || 'test', body.value, "EX", (body.ttl || 3600).toString()]);
      
      return new Response(JSON.stringify({ status: 'SET' }), { 
        headers: {'Content-Type': 'application/json'} 
      });
    } catch { 
      return new Response('Error', { status: 500 }); 
    }
  }
  
  if (req.method === 'GET' && key) {
    const data = await upstashRequest(["GET", key]);
    return new Response(JSON.stringify({ 
      status: data ? 'HIT' : 'MISS', 
      data 
    }), { 
      headers: {'Content-Type': 'application/json'} 
    });
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Cache Manager</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        :root {
          --bg: #121212;
          --card: #1e1e1e;
          --accent: #1db954;
          --text: #e0e0e0;
          /* INSET SHADOW KEREN */
          --inset: inset 6px 6px 12px #0b0b0b, inset -6px -6px 12px #313131;
          --outset: 6px 6px 12px #0b0b0b, -6px -6px 12px #313131;
        }
        body { margin:0; background: var(--bg); color: var(--text); font-family: 'Segoe UI', monospace; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        
        .dashboard {
          background: var(--card);
          width: 90%; max-width: 500px;
          padding: 2.5rem;
          border-radius: 20px;
          box-shadow: var(--inset); /* Box-nya masuk ke dalem */
          border: 1px solid rgba(255,255,255,0.05);
          position: relative;
        }

        h2 { 
          margin-top: 0; 
          border-bottom: 2px solid #252525; 
          padding-bottom: 15px; 
          color: var(--accent); 
          text-transform: uppercase;
          letter-spacing: 1px;
          display: flex; justify-content: space-between; align-items: center;
        }

        .badge {
          font-size: 0.7rem; background: #000; padding: 4px 8px; border-radius: 4px; color: #fff;
        }

        .row { margin: 1.5rem 0; display: flex; justify-content: space-between; align-items: center; }
        .label { font-size: 0.8rem; color: #888; text-transform: uppercase; }
        .val { font-family: monospace; font-size: 1.1rem; font-weight: bold; }

        /* Kotak Status Koneksi */
        .status-box {
          background: transparent;
          padding: 1rem;
          border-radius: 12px;
          box-shadow: var(--inset);
          text-align: center;
          margin-top: 2rem;
        }
        .status-text { color: var(--accent); font-weight: bold; }
        
        .code-block {
          background: #111;
          padding: 10px;
          border-radius: 8px;
          font-size: 0.8rem;
          color: #aaa;
          margin-top: 10px;
          border-left: 3px solid var(--accent);
        }
      </style>
    </head>
    <body>
      <div class="dashboard">
        <h2>
          Edge Cache
          <span class="badge">Vercel Edge</span>
        </h2>
        
        <div class="row">
          <div>
            <div class="label">Protocol</div>
            <div class="val">REST / HTTP</div>
          </div>
          <div style="text-align: right;">
            <div class="label">Driver</div>
            <div class="val">Native Fetch</div>
          </div>
        </div>

        <div class="status-box">
          <div class="label">System Status</div>
          <div class="status-text">LISTENING</div>
          <div style="font-size: 0.8rem; margin-top: 5px; color: #666;">Ready for GET/POST Operations</div>
        </div>

        <div class="row" style="margin-bottom:0;">
          <div style="width:100%">
            <div class="label">Endpoint Logic</div>
            <div class="code-block">
              &gt; Hybrid Mode Active<br>
              &gt; API (JSON) + GUI (HTML)
            </div>
          </div>
        </div>

      </div>
    </body>
    </html>
  `;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}