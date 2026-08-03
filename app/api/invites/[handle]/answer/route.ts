import { forward } from '@/lib/upstream';

/**
 * Forgetting an answer already acted on. The handle is the friend who accepted.
 *
 * Its own path rather than a flag on the sibling DELETE, because the two mean
 * opposite ends of the same exchange: that one declines somebody's ask to you,
 * this one clears an answer addressed to you. Collapsing them would let a
 * decline delete the room somebody is already sitting in.
 */
type Params = { params: Promise<{ handle: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { handle } = await params;
  return forward(`/invites/${encodeURIComponent(handle)}/answer`, { method: 'DELETE' });
}
