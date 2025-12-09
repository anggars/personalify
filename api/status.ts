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
      <title>Personalify System Status</title>
      <style>
        :root {
          --bg-color: #121212;
          --card-bg: #1e1e1e;
          --text-primary: #ffffff;
          --text-secondary: #b3b3b3;
          --accent: #1db954; /* Spotify Green */
          --accent-glow: rgba(29, 185, 84, 0.4);
          --danger: #e91429;
        }

        body {
          margin: 0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: var(--bg-color);
          color: var(--text-primary);
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }

        .container {
          background-color: var(--card-bg);
          width: 90%;
          max-width: 600px;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
          border: 1px solid #333;
          animation: fadeIn 0.8s ease-out;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2rem;
          border-bottom: 1px solid #333;
          padding-bottom: 1rem;
        }

        h1 { margin: 0; font-size: 1.5rem; letter-spacing: 1px; }
        
        .status-badge {
          background-color: rgba(29, 185, 84, 0.1);
          color: var(--accent);
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-weight: bold;
          font-size: 0.9rem;
          border: 1px solid var(--accent);
          box-shadow: 0 0 10px var(--accent-glow);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background-color: var(--accent);
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .metric {
          background: #252525;
          padding: 1rem;
          border-radius: 8px;
        }

        .label {
          color: var(--text-secondary);
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 0.5rem;
        }

        .value {
          font-size: 1.1rem;
          font-weight: 500;
        }

        .footer {
          text-align: center;
          color: #555;
          font-size: 0.8rem;
          margin-top: 2rem;
        }

        code {
          background: #000;
          padding: 2px 6px;
          border-radius: 4px;
          color: #ff79c6;
          font-family: monospace;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 var(--accent-glow); }
          70% { box-shadow: 0 0 0 6px rgba(29, 185, 84, 0); }
          100% { box-shadow: 0 0 0 0 rgba(29, 185, 84, 0); }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SYSTEM STATUS</h1>
          <div class="status-badge">
            <div class="status-dot"></div>
            OPERATIONAL
          </div>
        </div>

        <div class="grid">
          <div class="metric">
            <div class="label">Server Location</div>
            <div class="value">${city}, ${country}</div>
          </div>
          <div class="metric">
            <div class="label">Edge Region</div>
            <div class="value">${region}</div>
          </div>
          <div class="metric">
            <div class="label">Runtime Engine</div>
            <div class="value">Vercel Edge (Deno)</div>
          </div>
          <div class="metric">
            <div class="label">Response Time</div>
            <div class="value">&lt; 10ms</div>
          </div>
        </div>

        <div class="metric" style="margin-bottom: 1rem;">
           <div class="label">Current Server Time</div>
           <div class="value">${dateString}</div>
           <div class="value" style="color: var(--accent); margin-top: 4px; font-size: 1.2rem;">${timeString}</div>
        </div>

        <div class="metric">
          <div class="label">Request ID</div>
          <div class="value" style="font-size: 0.8rem; font-family: monospace; overflow-wrap: break-word;">${requestId}</div>
        </div>

        <div class="footer">
          Powered by <strong>Personalify Distributed Architecture</strong><br>
          Rendered server-side with TypeScript
        </div>
      </div>
    </body>
    </html>
  `;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}