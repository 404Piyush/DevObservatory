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

  // Reset state when the projectId changes or goes null. We track the
  // previous value via a ref so we only clear on transitions, never on
  // every effect run.
  const lastProjectIdRef = useRef<string | null>(projectId);
  useEffect(() => {
    if (lastProjectIdRef.current === projectId) return;
    lastProjectIdRef.current = projectId;
    // The ref guard above makes this fire only on real transitions, so
    // the setState-in-effect warning is a false positive here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLiveEvents([]);
    setConnected(false);
    retryRef.current = 0;
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    let closed = false;
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      source = new EventSource(`/api/projects/${projectId}/events/stream`);

      source.onopen = () => {
        if (closed) return;
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
        if (closed) return;
        setConnected(false);
        source?.close();
        const delay = Math.min(1000 * 2 ** retryRef.current, 15_000);
        retryRef.current += 1;
        timer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      source?.close();
    };
  }, [projectId]);

  return { liveEvents, connected };
}