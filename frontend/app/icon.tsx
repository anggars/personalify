import { ImageResponse } from 'next/og';

// Image metadata
export const size = {
    width: 32,
    height: 32,
};
export const contentType = 'image/png';

// Generate the favicon
export default async function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    fontSize: 20,
                    background: '#282828',
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
        {
            ...size,
        }
    );
}
