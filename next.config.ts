import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    /**
     * Every image in this game is pixel art. Next.js image optimisation
     * resamples and re-encodes images with smooth interpolation, which blurs
     * pixel edges — and it only kicks in for production builds, so the result
     * looks correct locally and wrong once deployed. Turning it off keeps the
     * PNGs byte-for-byte as generated.
     */
    unoptimized: true,
  },
};

export default nextConfig;
