import { ImageResponse } from 'next/og';

// Image metadata
export const size = {
    width: 32,
    height: 32,
};
export const contentType = 'image/png';

// Generate the favicon
export default function Icon() {
    return new ImageResponse(
        (
            // ImageResponse JSX element
            <div
                style={{
                    fontSize: 20,
                    background: '#282828', // Placeholder dark background similar to navbar button in dark mode
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '8px',
                    color: '#1DB954',
                    fontWeight: 800,
                    fontFamily: 'sans-serif',
                }}
            >
                P
            </div>
        ),
        // ImageResponse options
        {
            ...size,
        }
    );
}
