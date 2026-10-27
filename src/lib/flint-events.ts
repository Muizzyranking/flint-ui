"use client";

import { useEffect, useRef } from "react";

/**
 * Live transition events from the Flint API, streamed through the
 * same-origin proxy (`/api/flint/sse/stream`) — the server injects the API
 * key, and the browser only ever talks to this origin.
 *
 * Each event is one job transition; field set depends on the transition.
 * Keepalives arrive as comments and are ignored. Consumer callbacks are kept
 * in a ref so the EventSource is never torn down across renders.
 */
export type FlintEvent = {
  job_id: string;
  status: string;
  worker_id?: string;
  duration_ms?: number;
  retry_count?: number;
  available_at?: string;
  is_dlq?: boolean;
};

export function useFlintEvents(onEvent: (event: FlintEvent) => void) {
  const handler = useRef(onEvent);

  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const source = new EventSource("/api/flint/sse/stream");

    source.onmessage = (message) => {
      try {
        handler.current(JSON.parse(message.data) as FlintEvent);
      } catch {
        // Malformed line: skip, the stream continues.
      }
    };

    // onerror keeps reconnecting per EventSource semantics; nothing to do.
    return () => source.close();
  }, []);
}
