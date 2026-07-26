import { forward } from '@/lib/upstream';

/** The signed-in player's own record. */
export const GET = () => forward('/profile');

/** Change the name shown to opponents and on the leaderboard. */
export async function PUT(request: Request) {
  return forward('/profile', { method: 'PUT', body: await request.text() });
}
