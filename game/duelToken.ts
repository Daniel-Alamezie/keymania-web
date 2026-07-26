'use client';

/**
 * The access token the duel socket needs.
 *
 * Every other API call is proxied server-side so the token never enters the
 * page — but API Gateway holds the WebSocket itself, and browsers cannot set
 * headers on a WebSocket handshake, so for createRoom/joinRoom the client has
 * to present the token in the message body. This is the only path that fetches
 * it into browser memory, and it is deliberately narrow.
 */

/** Kinde access tokens last about an hour; re-reading well inside that keeps a
 *  long lobby session from presenting something that has just expired. */
const REFRESH_AFTER_MS = 5 * 60_000;

let cached: { token: string; at: number } | null = null;

export async function duelToken(): Promise<string | null> {
  if (cached && Date.now() - cached.at < REFRESH_AFTER_MS) return cached.token;

  try {
    const response = await fetch('/api/me/duel-token', { cache: 'no-store' });
    if (!response.ok) {
      cached = null;
      return null;
    }
    const { token } = (await response.json()) as { token?: string };
    if (!token) return null;

    cached = { token, at: Date.now() };
    return token;
  } catch {
    return null;
  }
}

/** Drop the cached token — call after signing out. */
export function forgetDuelToken(): void {
  cached = null;
}
