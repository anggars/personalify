export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const city = req.headers.get('x-vercel-ip-city') || 'Unknown';
  const logs = [
    `[INFO] Server initialized at ${city}`,
    `[INFO] Edge Runtime ready`,
    `[WARN] No external log provider configured`,
    `[INFO] Listening on port 443`,
    `[DEBUG] Cache warming up...`,
    `[SUCCESS] Personalify Core v2.0 loaded`,
  ];

  for(let i=0; i<5; i++) {
    logs.push(`[REQ] GET /api/genius?id=${Math.floor(Math.random()*9000)} - 200 OK`);
  }

  const logLines = logs.map(l => `<div class="line">${l}</div>`).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>System Logs</title>
      <style>
        body { background: #121212; color: #ccc; font-family: 'Courier New', monospace; padding: 20px; display:flex; justify-content:center; }
        .terminal {
          background: #1e1e1e;
          width: 100%; max-width: 700px;
          height: 80vh;
          border-radius: 12px;
          padding: 20px;
          /* INSET SHADOW DEEP */
          box-shadow: inset 5px 5px 15px #0a0a0a, inset -5px -5px 15px #2a2a2a;
          overflow-y: auto;
          border: 1px solid #333;
        }
        .line { margin-bottom: 8px; border-bottom: 1px solid #252525; padding-bottom: 4px; }
        .line:last-child { border-bottom: none; animation: blink 1s infinite; }
        h3 { color: #1db954; margin-top: 0; text-transform: uppercase; letter-spacing: 2px; }
        
        /* Scrollbar keren */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #1e1e1e; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #1db954; }
      </style>
    </head>
    <body>
      <div class="terminal">
        <h3>>_ System Logs / Live</h3>
        ${logLines}
        <div class="line" style="color: #1db954;">>_ Awaiting new input...</div>
      </div>
    </body>
    </html>
  `;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}