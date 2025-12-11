export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const city = req.headers.get('x-vercel-ip-city') || 'Jakarta';
  const region = req.headers.get('x-vercel-ip-country-region') || 'ID';
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-GB', { hour12: false, timeZone: 'Asia/Jakarta' });
  const dateString = now.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', timeZone: 'Asia/Jakarta' });

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>System Status</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="icon" href="https://assets.vercel.com/image/upload/front/favicon/vercel/favicon.ico">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');

        :root {
          --accent: #1db954;
          --text: #ffffff;
          --text-muted: #888888;
        }

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
          overflow-y: scroll;
          overflow-x: hidden;
          padding: 60px 20px 20px 20px; 
        }

        .nav-pill {
          position: fixed;
          top: 20px;
          display: flex;
          gap: 5px;
          background: #111;
          padding: 6px;
          border-radius: 50px;
          border: 1px solid #333;
          box-shadow: 0 4px 20px rgba(0,0,0,0.8);
          z-index: 100;
          flex-wrap: wrap;
          justify-content: center;
        }

        .nav-a {
          color: var(--text-muted);
          text-decoration: none;
          padding: 8px 16px;
          border-radius: 30px;
          font-size: 0.8rem;
          font-weight: 600;
          transition: all 0.2s ease;
        }

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
          animation: scaleUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          margin-top: 40px; 
        }

        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        h1 { margin: 0; font-size: 1.4rem; font-weight: 800; letter-spacing: -0.5px; }

        .status-badge {
          background: rgba(29, 185, 84, 0.15);
          color: var(--accent);
          padding: 5px 10px;
          border-radius: 8px;
          font-size: 0.7rem;
          font-weight: 700;
          border: 1px solid rgba(29, 185, 84, 0.3);
          display: flex; align-items: center; gap: 6px;
        }
        .dot { width: 6px; height: 6px; background: currentColor; border-radius: 50%; box-shadow: 0 0 5px currentColor; }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }

        .metric {
          background: #1a1a1a;
          border-radius: 12px;
          padding: 15px;
          border: 1px solid #2a2a2a;
        }

        .label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; font-weight: 600; }
        .value { font-size: 1rem; font-weight: 600; color: #fff; word-break: break-word; }
        .big-val { font-size: 1.6rem; font-weight: 700; color: #fff; }

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
        <a href="/api/status" class="nav-a active">Status</a>
        <a href="/api/monitor" class="nav-a">Monitor</a>
        <a href="/api/cache" class="nav-a">Cache</a>
        <a href="/api/log" class="nav-a">Logs</a>
      </div>

      <div class="card-section">
        <div class="header">
          <h1>System Overview</h1>
          <div class="status-badge"><div class="dot"></div> ONLINE</div>
        </div>

        <div class="grid">
          <div class="metric">
            <div class="label">Region</div>
            <div class="value">${region}</div>
          </div>
          <div class="metric">
            <div class="label">City</div>
            <div class="value">${city}</div>
          </div>
          <div class="metric" style="grid-column: span 2;">
            <div class="label">Local Time (WIB)</div>
            <div class="big-val">${timeString}</div>
            <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 5px;">${dateString}</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}