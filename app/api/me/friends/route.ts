import { forward } from '@/lib/upstream';

/** Everyone the signed-in player is connected to, plus pending requests both ways. */
export const GET = () => forward('/friends');

/** Send a friend request, addressed by handle. */
export async function POST(request: Request) {
  return forward('/friends', { method: 'POST', body: await request.text() });
}
