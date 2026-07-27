import { forward } from '@/lib/upstream';

/**
 * Acting on one relationship.
 *
 * The handle is encoded rather than interpolated raw: it arrives from a URL and
 * is about to become part of another one, and the upstream route resolves it
 * against a lookup table. Canonical handles contain nothing that needs escaping,
 * but this is the boundary where that stops being guaranteed.
 */
type Params = { params: Promise<{ handle: string }> };

/** Accept a pending request, or block/unblock — the body says which. */
export async function PUT(request: Request, { params }: Params) {
  const { handle } = await params;
  return forward(`/friends/${encodeURIComponent(handle)}`, {
    method: 'PUT',
    body: await request.text(),
  });
}

/** Remove a friend, decline a request, or withdraw one — all the same thing. */
export async function DELETE(_request: Request, { params }: Params) {
  const { handle } = await params;
  return forward(`/friends/${encodeURIComponent(handle)}`, { method: 'DELETE' });
}
