import { forward } from '@/lib/upstream';

/**
 * Everyone the signed-in player is connected to, plus pending requests both ways.
 *
 * `?include=weekly` is passed through, and it is the only thing that is. The
 * flag costs the upstream one extra read per friend, so it is forwarded as an
 * exact value rather than by copying the caller's query string — a proxy that
 * relays whatever it is handed is a proxy that lets a browser choose how much
 * the server does.
 */
export function GET(request: Request) {
  const weekly = new URL(request.url).searchParams.get('include') === 'weekly';
  return forward(weekly ? '/friends?include=weekly' : '/friends');
}

/** Send a friend request, addressed by handle. */
export async function POST(request: Request) {
  return forward('/friends', { method: 'POST', body: await request.text() });
}
