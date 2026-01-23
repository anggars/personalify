import { ImageResponse } from 'next/og';

// Image metadata
export const size = {
    width: 180,
    height: 180,
};
export const contentType = 'image/png';

// Generate the apple touch icon
export default async function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    fontSize: 100,
                    background: '#282828',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '32px',
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
