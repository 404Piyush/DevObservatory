"use client";

import { useEffect, useRef } from "react";

/**
 * Run a callback once whenever `value` changes from undefined/null/empty to
 * a non-empty value, and again whenever it changes to a new non-empty value
 * (e.g. refetched data). The callback fires at most once per value reference.
 *
 * Used for "auto-select the first org/project" — we want to set the selector
 * when data first arrives, but we don't want to clobber a user-picked value
 * on every refetch.
 */
export function useAutoSelect<T>(
  value: T | null | undefined,
  shouldRun: boolean,
  callback: (v: T) => void,
) {
  const lastValueRef = useRef<T | null | undefined>(undefined);
  useEffect(() => {
    if (!shouldRun) return;
    if (value == null) return;
    if (lastValueRef.current === value) return;
    lastValueRef.current = value;
    callback(value as T);
  }, [value, shouldRun, callback]);
}