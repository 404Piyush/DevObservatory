"use client";

import { useEffect, useRef, useState } from "react";

import type { EventRecord } from "./queries";

/**
 * Subscribe to a project's event stream via SSE.
 *
 * Returns the most recent events as they arrive. The stream auto-reconnects
 * with exponential backoff and pauses while no project is selected.
 */
export function useEventStream(projectId: string | null) {
  const [liveEvents, setLiveEvents] = useState<EventRecord[]>([]);
  const [connected, setConnected] = useState(false);
  const retryRef = useRef(0);
  const closedRef = useRef(false);

  useEffect(() => {
    if (!projectId) {
      setLiveEvents([]);
      setConnected(false);
      return;
    }
    closedRef.current = false;
    retryRef.current = 0;

    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closedRef.current) return;
      source = new EventSource(`/api/projects/${projectId}/events/stream`);

      source.onopen = () => {
        setConnected(true);
        retryRef.current = 0;
      };

      source.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as Partial<EventRecord>;
          // Filter out the bare {"project_id": "..."} initial probe; require id
          if (typeof data.id !== "number") return;
          const event = data as EventRecord;
          setLiveEvents((prev) => [event, ...prev].slice(0, 200));
        } catch {
          // ignore malformed
        }
      };

      source.onerror = () => {
        setConnected(false);
        source?.close();
        if (closedRef.current) return;
        const delay = Math.min(1000 * 2 ** retryRef.current, 15_000);
        retryRef.current += 1;
        timer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closedRef.current = true;
      if (timer) clearTimeout(timer);
      source?.close();
    };
  }, [projectId]);

  return { liveEvents, connected };
}