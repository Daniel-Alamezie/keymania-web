import { forward } from '@/lib/upstream';

/** Report a bot-practice result. Stored unranked — see the API's reportDuel. */
export async function POST(request: Request) {
  return forward('/duels', { method: 'POST', body: await request.text() });
}
