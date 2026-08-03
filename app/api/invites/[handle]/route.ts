import { forward } from '@/lib/upstream';

/** Turning an invite down. The handle is the person who sent it. */
type Params = { params: Promise<{ handle: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { handle } = await params;
  return forward(`/invites/${encodeURIComponent(handle)}`, { method: 'DELETE' });
}
