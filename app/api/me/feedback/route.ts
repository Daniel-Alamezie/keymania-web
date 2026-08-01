import { forward } from '@/lib/upstream';

/**
 * Send a bug report or an idea.
 *
 * Proxied like every other authenticated call so the access token is attached
 * server-side and never reaches the page. Under `/me` because the API refuses
 * this without an account — a report you cannot reply to is worth a fraction of
 * one you can.
 */
export async function POST(request: Request) {
  return forward('/feedback', { method: 'POST', body: await request.text() });
}
