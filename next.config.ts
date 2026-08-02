import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * The vercel.app hostname bows out.
   *
   * Every Reddit comment and social post so far links keymania-web.vercel.app,
   * and left alone those links would keep Google seeing two sites with the
   * same content, splitting rank between them. A permanent redirect hands the
   * old host's standing to the real domain and every old link keeps working.
   *
   * Host-conditional, so it only fires on the old hostname — and merged only
   * once keymania.app actually resolves, because shipped early it would bounce
   * every visitor to a domain that does not exist yet.
   */
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'keymania-web.vercel.app' }],
        destination: 'https://keymania.app/:path*',
        permanent: true,
      },
      /**
       * www folds into the apex, for the same reason the vercel.app host does.
       *
       * Both were serving the site independently and answering 200, which is
       * the duplicate-content split the canonical work exists to prevent —
       * and it would also have meant a second set of Kinde callback URLs to
       * keep in step forever. One host answers; the other points at it.
       */
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.keymania.app' }],
        destination: 'https://keymania.app/:path*',
        permanent: true,
      },
    ];
  },
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
