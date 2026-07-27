'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

    socket.onopen = () => setStatus('open');
    socket.onclose = () => setStatus('closed');
    socket.onerror = () => setStatus('error');
    socket.onmessage = (raw) => {
      try {
        const message = JSON.parse(raw.data as string) as ServerMessage;
        listeners.current.forEach((handler) => handler(message));
      } catch {
        /* ignore anything that is not JSON */
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    setStatus('idle');
  }, []);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }, []);

  useEffect(() => () => socketRef.current?.close(), []);

  return { status, subscribe, connect, disconnect, send, configured: Boolean(WS_URL) };
}
