import { ImageResponse } from 'next/og';

// Image metadata
export const size = {
    width: 180,
    height: 180,
};
export const contentType = 'image/png';

// Generate the apple touch icon
export default function Icon() {
    return new ImageResponse(
        (
            // ImageResponse JSX element
            <div
                style={{
                    fontSize: 100,
                    background: '#282828', // Placeholder dark background similar to navbar button in dark mode
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '32px', // Larger radius for larger icon
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
