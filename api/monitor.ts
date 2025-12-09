declare const process: { env: { [key: string]: string | undefined } };
export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  let redisStatus = 'Checking...';
  let latency = 0;
  
  const start = Date.now();
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const r = await fetch(`${UPSTASH_URL}/ping`, { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } });
      redisStatus = r.ok ? 'HEALTHY' : 'ERROR';
    } catch { redisStatus = 'DOWN'; }
    latency = Date.now() - start;
  } else {
    redisStatus = 'NO CONFIG';
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>System Monitor</title>
      <style>
        :root {
          --bg: #121212;
          --box-bg: #1e1e1e;
          --accent: ${redisStatus === 'HEALTHY' ? '#1db954' : '#ff5555'}; /* Ijo kalau sehat, Merah kalau sakit */
          --shadow-inset: inset 6px 6px 12px #0b0b0b, inset -6px -6px 12px #313131;
        }
        body { background: var(--bg); color: #fff; font-family: monospace; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        
        .monitor-box {
          background: var(--box-bg);
          width: 90%; max-width: 600px;
          padding: 2rem;
          border-radius: 15px;
          box-shadow: var(--shadow-inset);
          border: 1px solid #333;
        }

        .screen {
          background: #000;
          height: 150px;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          position: relative;
          overflow: hidden;
          box-shadow: inset 0 0 20px rgba(0,0,0,0.8);
          border: 1px solid #333;
          display: flex; align-items: center; justify-content: center;
        }

        /* JANTUNG CHART ANIMATION */
        .heartbeat-line {
          position: absolute;
          left: 0; bottom: 50%;
          width: 100%; height: 2px;
          background: rgba(29, 185, 84, 0.2);
        }
        
        svg { width: 100%; height: 100%; }
        polyline {
          fill: none;
          stroke: var(--accent);
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
          animation: dash 2s linear infinite;
        }

        @keyframes dash {
          to { stroke-dashoffset: -1000; }
        }

        .stats-row { display: flex; justify-content: space-between; margin-top: 20px; }
        .stat { 
          width: 48%; padding: 15px; 
          border-radius: 10px; 
          box-shadow: var(--shadow-inset);
          text-align: center;
        }
        .val { font-size: 1.5rem; font-weight: bold; color: var(--accent); margin-top: 5px; }
        .lbl { font-size: 0.8rem; color: #888; }

        .blink { animation: blinker 1s linear infinite; }
        @keyframes blinker { 50% { opacity: 0; } }
      </style>
    </head>
    <body>
      <div class="monitor-box">
        <h2 style="margin-top:0; border-bottom: 1px solid #333; padding-bottom:10px;">
          <span class="blink">●</span> LIVE MONITOR
        </h2>
        
        <div class="screen">
          <div class="heartbeat-line"></div>
          
          <svg viewBox="0 0 500 100" preserveAspectRatio="none">
             <polyline points="0,50 50,50 70,20 90,80 110,50 150,50 200,50 220,10 240,90 260,50 300,50 350,50 370,30 390,70 410,50 500,50" 
             stroke-dasharray="500" stroke-dashoffset="0" />
          </svg>
        </div>

        <div class="stats-row">
          <div class="stat">
            <div class="lbl">REDIS STATUS</div>
            <div class="val">${redisStatus}</div>
          </div>
          <div class="stat">
            <div class="lbl">LATENCY</div>
            <div class="val">${latency}ms</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}