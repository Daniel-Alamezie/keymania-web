import { forward } from '@/lib/upstream';

/**
 * "I am here." Posted every fifteen seconds while the game is open.
 *
 * The most frequent call this app makes, and the least interesting: it writes
 * a timestamp on the caller's own row and answers nothing. Presence is read
 * inside the friends list, which is the only place it is anybody's business.
 */
export async function POST(request: Request) {
  return forward('/presence', { method: 'POST', body: await request.text() });
}
