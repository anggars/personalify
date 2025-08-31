// api/proxy.js
export default async function handler(req, res) {
  const { method, url, headers, body } = req;
  
  // Extract path dari URL Vercel
  const path = url.replace('/api', '');
  
  // Backend URL Render
  const backendUrl = `https://personalify-irf2.onrender.com${path}`;
  
  try {
    // Forward request ke backend Render
    const response = await fetch(backendUrl, {
      method,
      headers: {
        ...headers,
        'host': undefined, // Remove host header
        'x-forwarded-for': undefined,
        'x-forwarded-proto': undefined,
        'x-vercel-ip': undefined,
      },
      body: method !== 'GET' && method !== 'HEAD' ? JSON.stringify(body) : undefined,
    });

    // Forward response headers
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // Forward status code
    res.status(response.status);

    // Forward response body
    const responseBody = await response.text();
    res.send(responseBody);

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Backend unavailable' });
  }
}