import type { MetadataRoute } from 'next';

/**
 * Everything is crawlable except the BFF proxy, which serves JSON for the
 * game and has no business in an index. The sitemap points crawlers at the
 * canonical host rather than whichever alias they arrived through.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: 'https://keymania.app/sitemap.xml',
  };
}
