'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from './analytics';
import type { ClientMessage, ServerMessage, SocketStatus } from '@/models/protocol';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? '';

export type MessageHandler = (message: ServerMessage) => void;

/**
 * Owns the WebSocket to the duel server.
 *
 * API Gateway holds the connection; this hook opens it, sends `{ action }`
 * messages and fans incoming ones out to subscribers.
 *
 * Consumers subscribe rather than reading a "last message" value: messages are
 * events, not state. Delivering them through a callback means each is handled
 * exactly once by construction — no sequence numbers to dedupe repeats, and no
 * setState cascading out of an effect body.
 */
export function useDuelSocket() {
  const socketRef = useRef<WebSocket | null>(null);
  const listeners = useRef(new Set<MessageHandler>());
  /**
   * Messages asked for before the socket finished opening.
   *
   * Every caller here does the same thing: `connect()`, then `send()`. A
   * WebSocket takes a round trip to open, so that second call used to land on a
   * socket in `CONNECTING` and be dropped on the floor without a word. The
   * button appeared to do nothing, and clicking it again worked, because by then
   * the socket the *first* click opened was live. That is exactly what survival
   * did: one click armed the connection, the second started the run.
   *
   * `connect()` returning a promise would be the other fix and a worse one — it
   * would put an await in front of every action and leave each caller to
   * remember it. Queueing puts the knowledge in the one place that knows when
   * the socket is ready.
   */
  const pending = useRef<ClientMessage[]>([]);
  const [status, setStatus] = useState<SocketStatus>('idle');

  const subscribe = useCallback((handler: MessageHandler) => {
    listeners.current.add(handler);
    return () => {
      listeners.current.delete(handler);
    };
  }, []);

  const connect = useCallback(() => {
    if (!WS_URL) {
      setStatus('error');
      return;
    }
    if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) return;

    setStatus('connecting');
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus('open');
      // Taken before sending, so a handler that sends in response to one of
      // these queues onto a fresh list rather than a list being iterated.
      const queued = pending.current;
      pending.current = [];
      queued.forEach((message) => socket.send(JSON.stringify(message)));
    };
    /**
     * A socket that never opened takes its queue with it.
     *
     * Holding the messages would mean a run created on the next connection out
     * of a click the player made minutes ago and has long since given up on.
     */
    socket.onclose = () => { pending.current = []; setStatus('closed'); };
    socket.onerror = () => { pending.current = []; setStatus('error'); };
    socket.onmessage = (raw) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(raw.data as string) as ServerMessage;
      } catch {
        return; // not JSON — API Gateway noise, genuinely ignorable
      }

      /**
       * Handlers crash on their own account, and loudly.
       *
       * One catch used to cover both the parse and the handlers, built for
       * non-JSON frames — and it equally swallowed a handler throwing. A
       * handler that throws on every message is a frozen screen with a live
       * socket: the duel keeps sending, nothing renders, and not one error
       * appears anywhere. Two duels froze exactly that way before this event
       * existed to say which side broke.
       *
       * Per handler, so one crashing subscriber cannot starve the others.
       */
      listeners.current.forEach((handler) => {
        try {
          handler(message);
        } catch (error) {
          console.error('duel message handler crashed', message.type, error);
          track({
            name: 'handler_crashed',
            messageType: message.type,
            error: error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 200) : 'unknown',
          });
        }
      });
    };
  }, []);

  const disconnect = useCallback(() => {
    pending.current = [];
    socketRef.current?.close();
    socketRef.current = null;
    setStatus('idle');
  }, []);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      return;
    }
    // Still opening: held until it is, then flushed in order by `onopen`.
    if (socket?.readyState === WebSocket.CONNECTING) pending.current.push(message);
    // Anything else — no socket, or one already closed — is still dropped. There
    // is nothing on its way for this to arrive behind.
  }, []);

  useEffect(() => () => socketRef.current?.close(), []);

  return { status, subscribe, connect, disconnect, send, configured: Boolean(WS_URL) };
}
