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
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');

        :root {
          --glass-bg: rgba(255, 255, 255, 0.05);
          --glass-border: rgba(255, 255, 255, 0.1);
          --glass-blur: blur(20px);
          --accent: #1db954;
          --text: #ffffff;
          --text-muted: #b3b3b3;
        }

        body {
          margin: 0;
          background: radial-gradient(circle at top left, #1e1e1e, #000000);
          font-family: 'Inter', -apple-system, sans-serif; 
          color: var(--text);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center; 
          min-height: 100vh;
          overflow: hidden;
        }

        .nav-pill {
          position: fixed;
          top: 20px;
          display: flex;
          gap: 5px;
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: var(--glass-blur);
          padding: 8px;
          border-radius: 50px;
          border: 1px solid var(--glass-border);
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          z-index: 100;
        }

        .nav-a {
          color: var(--text-muted);
          text-decoration: none;
          padding: 8px 20px;
          border-radius: 30px;
          font-size: 0.85rem;
          font-weight: 600;
          transition: 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .nav-a:hover { color: #fff; background: rgba(255,255,255,0.1); }
        .nav-a.active { background: var(--accent); color: #000; box-shadow: 0 0 15px rgba(29, 185, 84, 0.4); }

        .glass-card {
          width: 90%;
          max-width: 480px;
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur);
          -webkit-backdrop-filter: var(--glass-blur);
          border: 1px solid var(--glass-border);
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          animation: floatUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
          margin-top: 60px; 
        }

        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        h1 { margin: 0; font-size: 1.5rem; font-weight: 800; letter-spacing: -0.5px; }

        .status-badge {
          background: rgba(29, 185, 84, 0.2);
          color: var(--accent);
          padding: 6px 12px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 700;
          border: 1px solid rgba(29, 185, 84, 0.3);
          display: flex; align-items: center; gap: 6px;
        }
        .dot { width: 6px; height: 6px; background: currentColor; border-radius: 50%; box-shadow: 0 0 8px currentColor; }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }

        .metric {
          background: rgba(255,255,255,0.03);
          border-radius: 16px;
          padding: 20px;
          border: 1px solid rgba(255,255,255,0.05);
          transition: 0.2s;
        }
        .metric:hover { background: rgba(255,255,255,0.06); transform: translateY(-2px); }

        .label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: 600; }
        .value { font-size: 1.1rem; font-weight: 600; color: #fff; }
        .big-val { font-size: 1.8rem; font-weight: 700; color: #fff; }

        @keyframes floatUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
      </style>
    </head>
    <body>
      <div class="nav-pill">
        <a href="/api/status" class="nav-a active">Status</a>
        <a href="/api/monitor" class="nav-a">Monitor</a>
        <a href="/api/cache" class="nav-a">Cache</a>
        <a href="/api/log" class="nav-a">Logs</a>
      </div>

      <div class="glass-card">
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
            <div style="color: var(--text-muted); font-size: 0.9rem; margin-top: 5px;">${dateString}</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}