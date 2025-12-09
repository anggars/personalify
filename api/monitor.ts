declare const process: { env: { [key: string]: string | undefined } };

export const config = {
  runtime: 'edge', 
};

export default async function handler(req: Request) {
  const start = Date.now();

  const city = req.headers.get('x-vercel-ip-city') || 'Unknown';
  const region = req.headers.get('x-vercel-ip-country-region') || 'Unknown';
  const country = req.headers.get('x-vercel-ip-country') || 'Unknown';

  let redisStatus = 'SKIPPED (No Config)';
  let redisLatency = 0;

  const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (UPSTASH_URL && UPSTASH_TOKEN) {
    const redisStart = Date.now();
    try {
        const res = await fetch(`${UPSTASH_URL}/ping`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
      });
      if (res.ok) {
        redisStatus = 'ONLINE (Connected)';
      } else {
        redisStatus = `ERROR (${res.status})`;
      }
    } catch (e: any) {
      redisStatus = `DOWN (${e.message})`;
    }
    redisLatency = Date.now() - redisStart;
  }

  const totalLatency = Date.now() - start;

  const healthReport = {
    status: redisStatus.includes('ONLINE') ? 'HEALTHY' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    system: {
      runtime: 'Vercel Edge (TypeScript)',
      location: `${city}, ${region}, ${country}`,
    },
    checks: {
      redis_connection: redisStatus,
      redis_latency_ms: redisLatency,
      total_latency_ms: totalLatency,
    },
    message: "Personalify System Monitor is Active"
  };

  return new Response(JSON.stringify(healthReport, null, 2), {
    status: redisStatus.includes('DOWN') ? 503 : 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}