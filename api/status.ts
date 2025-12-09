export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const city = req.headers.get('x-vercel-ip-city') || 'Unknown City';
  const country = req.headers.get('x-vercel-ip-country') || 'Unknown Country';
  const region = req.headers.get('x-vercel-ip-country-region') || 'Global';
  const requestId = req.headers.get('x-vercel-id') || 'dev-mode';
  
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', { timeZoneName: 'short' });
  const dateString = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>System Status</title>
      <style>
        :root {
          --bg-color: #121212;
          --text-primary: #e0e0e0;
          --text-secondary: #a0a0a0;
          --accent: #1db954;
          --container-bg: #1e1e1e;
          --shadow-inset: inset 8px 8px 16px #0b0b0b, inset -8px -8px 16px #313131;
          --shadow-out: 8px 8px 16px #0b0b0b, -8px -8px 16px #313131;
        }

        body {
          margin: 0;
          font-family: 'Segoe UI', monospace;
          background-color: var(--bg-color);
          color: var(--text-primary);
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
        }

        .container {
          background-color: var(--container-bg);
          width: 100%;
          max-width: 500px;
          border-radius: 20px;
          padding: 2.5rem;
          /* Box Shadow Inset (Style Box) */
          box-shadow: var(--shadow-inset);
          border: 1px solid rgba(255,255,255,0.05);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          border-bottom: 2px solid #2a2a2a;
          padding-bottom: 15px;
        }

        h1 { margin: 0; font-size: 1.4rem; letter-spacing: 1.5px; text-transform: uppercase; color: var(--accent); }
        
        .status-pill {
          background: #1e1e1e;
          color: var(--accent);
          padding: 5px 15px;
          border-radius: 50px;
          font-size: 0.8rem;
          font-weight: bold;
          box-shadow: var(--shadow-out); /* Nonjol dikit */
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dot { width: 8px; height: 8px; background: var(--accent); border-radius: 50%; box-shadow: 0 0 10px var(--accent); }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }

        .metric-box {
          background: transparent;
          padding: 1rem;
          border-radius: 12px;
          /* Inset buat setiap kotak info */
          box-shadow: inset 4px 4px 8px #151515, inset -4px -4px 8px #272727;
          text-align: center;
        }

        .label { font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 5px; }
        .value { font-size: 1rem; font-weight: 600; }
        .large { font-size: 1.5rem; color: var(--accent); }

        .footer { margin-top: 2rem; text-align: center; font-size: 0.75rem; color: #555; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Status</h1>
          <div class="status-pill"><div class="dot"></div> ONLINE</div>
        </div>

        <div class="grid">
          <div class="metric-box">
            <div class="label">Region</div>
            <div class="value">${region}</div>
          </div>
          <div class="metric-box">
            <div class="label">City</div>
            <div class="value">${city}</div>
          </div>
        </div>

        <div class="metric-box" style="margin-top: 1.5rem;">
          <div class="label">Server Time</div>
          <div class="value large">${timeString}</div>
          <div class="label" style="margin-top:5px;">${dateString}</div>
        </div>

        <div class="footer">
          Request ID: ${requestId} <br> Vercel Edge Runtime
        </div>
      </div>
    </body>
    </html>
  `;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}