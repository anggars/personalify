// vercel-deploy/api/genius.js
export default async function handler(req, res) {
    // Ambil query pencarian dari URL, contoh: /api/genius?q=Bohemian%20Rhapsody
    const searchQuery = req.query.q;
    if (!searchQuery) {
        return res.status(400).json({ error: 'Search query "q" is required.' });
    }

    const geniusUrl = `https://api.genius.com/search?q=${encodeURIComponent(searchQuery)}`;
    const accessToken = process.env.GENIUS_ACCESS_TOKEN;

    if (!accessToken) {
         return res.status(500).json({ error: 'Genius Access Token is not configured.' });
    }

    try {
        const response = await fetch(geniusUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error(`Genius API responded with status ${response.status}`);
        }

        const data = await response.json();
        // Kirim kembali hanya bagian 'hits' dari respons Genius
        res.status(200).json(data.response.hits);

    } catch (error) {
        console.error('[GENIUS PROXY ERROR]', error);
        res.status(502).json({ error: 'Failed to fetch data from Genius API.' });
    }
}