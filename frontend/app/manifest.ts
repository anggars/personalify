import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Personalify',
        short_name: 'Personalify',
        description: 'Visualize your Spotify listening habits',
        start_url: '/',
        display: 'standalone',
        background_color: '#121212',
        theme_color: '#1DB954',
        icons: [
            {
                src: '/icon',
                sizes: 'any',
                type: 'image/png',
            },
            {
                src: '/apple-icon',
                sizes: '180x180',
                type: 'image/png',
            },
        ],
    };
}
