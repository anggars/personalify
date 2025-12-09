export const config = {
  runtime: 'edge',
};

interface ServerInfo {
  runtime: string;
  region: string;
  timestamp: string;
  features: string[];
  memory_usage?: string;
  request_metadata: {
    city: string;
    country: string;
    protocol: string;
  };
}

export default async function handler(req: Request) {
  const city = req.headers.get('x-vercel-ip-city') || 'Unknown City';
  const country = req.headers.get('x-vercel-ip-country') || 'Unknown Country';
  const region = req.headers.get('x-vercel-ip-country-region') || 'Unknown Region';
  const protocol = req.headers.get('x-forwarded-proto') || 'https';

  const info: ServerInfo = {
    runtime: 'Vercel Edge Runtime (Deno Compatible)',
    region: `${city}, ${region}, ${country}`,
    timestamp: new Date().toISOString(),
    features: [
      'Zero-Cold-Start',
      'Global Replication',
      'TypeScript Native Support',
      'Secure Headers Parsing'
    ],
    request_metadata: {
      city,
      country,
      protocol
    }
  };

  info.memory_usage = 'Optimized (Sandboxed Isolation)';

  return new Response(JSON.stringify(info, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
      'X-Powered-By': 'Personalify-Edge-Engine'
    }
  });
}