'use client';

import { useTrackPath } from '@/game/lastPath';

/**
 * Records the page being left, for Back controls to point at.
 *
 * Renders nothing. It lives in the root layout because the value has to be
 * kept across every navigation, including ones that pass through pages with
 * no Back control of their own.
 */
export default function TrackPath() {
  useTrackPath();
  return null;
}
