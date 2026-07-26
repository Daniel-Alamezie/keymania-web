import { forward } from '@/lib/upstream';

/**
 * The standings.
 *
 * Public upstream, but still proxied: it keeps the API's address out of the
 * browser bundle, so the duel server is reachable only through routes this app
 * actually offers.
 */
export const GET = () => forward('/leaderboard', {}, { auth: false });
