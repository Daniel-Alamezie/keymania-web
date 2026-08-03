import { forward } from '@/lib/upstream';

/** Taking up an invite. The handle is the person who sent it. */
type Params = { params: Promise<{ handle: string }> };

/**
 * Answers with the room code, or with a reason there isn't one.
 *
 * The upstream consumes the invite here rather than on the join, so this is
 * the call that can be raced and the join that follows cannot be.
 */
export async function POST(_request: Request, { params }: Params) {
  const { handle } = await params;
  return forward(`/invites/${encodeURIComponent(handle)}/accept`, { method: 'POST' });
}
