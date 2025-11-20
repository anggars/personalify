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
          // Meneruskan header penting dari request asli
          'user-agent': req.headers['user-agent'],
          'accept': req.headers['accept'],
          'content-type': req.headers['content-type'],
          'authorization': req.headers['authorization'],
          'cookie': req.headers['cookie'],

          // ▼▼▼ INI KODE TAMBAHANNYA ▼▼▼
          // Memberitahu Render siapa "pengirim aslinya" (yaitu Vercel)
          'x-forwarded-host': req.headers.host,

          // Memberitahu Render siapa "tamu yang dituju" (yaitu Render sendiri)
          'host': 'personalify-irf2.onrender.com'
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