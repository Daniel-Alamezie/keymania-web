import { forward } from '@/lib/upstream';

/**
 * Asking a friend for a game, and taking the ask back.
 *
 * The handle is encoded rather than interpolated raw, for the same reason as
 * the sibling route: it arrives from a URL and is about to become part of
 * another one.
 */
type Params = { params: Promise<{ handle: string }> };

/** Invite them into a private room you are already sitting in. */
export async function POST(request: Request, { params }: Params) {
  const { handle } = await params;
  return forward(`/friends/${encodeURIComponent(handle)}/invite`, {
    method: 'POST',
    body: await request.text(),
  });
}

/** Withdraw one you sent. */
export async function DELETE(_request: Request, { params }: Params) {
  const { handle } = await params;
  return forward(`/friends/${encodeURIComponent(handle)}/invite`, { method: 'DELETE' });
}
