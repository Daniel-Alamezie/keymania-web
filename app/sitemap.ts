import type { MetadataRoute } from 'next';

/**
 * The pages worth a crawler's time. Player profiles are deliberately absent:
 * they are thin, they churn, and a hundred near-identical pages of stats
 * dilute rather than build a small site's standing. If the game ever grows
 * public profile pages worth reading, they earn their entries then.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://keymania.app/', changeFrequency: 'weekly', priority: 1 },
    { url: 'https://keymania.app/leaderboard', changeFrequency: 'daily', priority: 0.8 },
  ];
}
