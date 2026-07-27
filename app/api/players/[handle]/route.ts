import { forward } from '@/lib/upstream';

/**
 * Somebody else's profile.
 *
 * Under /api/players rather than /api/me, because everything under /api/me is
 * about the caller and this deliberately is not. It still goes through the
 * proxy: the upstream route is authenticated, so the bearer token has to be
 * attached server-side like every other call.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return forward(`/players/${encodeURIComponent(handle)}`);
}
