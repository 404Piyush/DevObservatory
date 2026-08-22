"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type Frame = {
  function: string | null;
  file: string | null;
  line: number | null;
  col: number | null;
  in_app?: boolean | null;
  raw?: unknown;
};

type Props = {
  /** Raw value from `properties.stack`. Accepts Sentry-style objects,
   *  Python traceback strings, or JS-style strings. */
  stack: unknown;
  className?: string;
};

/** Pretty-print a stack trace as a list of frames. */
export function StackTrace({ stack, className }: Props) {
  const frames = useMemo(() => parseStack(stack), [stack]);
  const [showAll, setShowAll] = useState(false);

  if (frames === null) {
    return (
      <pre className={cn("overflow-x-auto rounded bg-muted p-2 text-xs", className)}>
        <code>{JSON.stringify(stack, null, 2)}</code>
      </pre>
    );
  }

  const visible = showAll ? frames : frames.slice(0, 10);

  return (
    <div className={cn("rounded-md border bg-muted/40 p-2", className)}>
      <ol className="space-y-1">
        {visible.map((frame, i) => (
          <li
            key={i}
            className={cn(
              "flex items-start gap-2 rounded px-1.5 py-1 font-mono text-xs",
              frame.in_app === false && "opacity-60",
              frame.in_app === true && "bg-indigo-500/5",
            )}
          >
            <span className="shrink-0 select-none text-muted-foreground">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-foreground">{frame.function ?? "<anonymous>"}</div>
              <div className="truncate text-muted-foreground">
                <span className="font-mono">{frame.file ?? "<unknown>"}</span>
                {frame.line != null ? (
                  <span>
                    :<span className="text-foreground">{frame.line}</span>
                    {frame.col != null ? <span>:{frame.col}</span> : null}
                  </span>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {frames.length > 10 ? (
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? (
            <>
              <ChevronDown className="h-3 w-3" /> Show less
            </>
          ) : (
            <>
              <ChevronRight className="h-3 w-3" /> Show all {frames.length} frames
            </>
          )}
        </button>
      ) : null}
    </div>
  );
}

type ParsedFrame = Frame;

function parseStack(value: unknown): ParsedFrame[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const out: ParsedFrame[] = [];
  for (const item of value) {
    const frame = parseOne(item);
    if (frame) out.push(frame);
  }
  return out.length > 0 ? out : null;
}

function parseOne(item: unknown): ParsedFrame | null {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const obj = item as Record<string, unknown>;
    return {
      function: (obj.function ?? obj.method ?? null) as string | null,
      file: (obj.filename ?? obj.file ?? obj.abs_path ?? null) as string | null,
      line: coerceInt(obj.lineno ?? obj.line),
      col: coerceInt(obj.colno ?? obj.col),
      in_app: (obj.in_app as boolean | null | undefined) ?? null,
      raw: item,
    };
  }
  if (typeof item === "string") {
    const line = item.trim();
    const pyMatch = line.match(/^File "([^"]+)", line (\d+)(?:, in (.+))?/);
    if (pyMatch) {
      return {
        function: pyMatch[3] ?? null,
        file: pyMatch[1],
        line: Number(pyMatch[2]),
        col: null,
        in_app: null,
        raw: item,
      };
    }
    const jsParens = line.match(/^at (.+?) \(([^):]+):(\d+)(?::(\d+))?\)/);
    if (jsParens) {
      return {
        function: jsParens[1],
        file: jsParens[2],
        line: Number(jsParens[3]),
        col: jsParens[4] ? Number(jsParens[4]) : null,
        in_app: null,
        raw: item,
      };
    }
    const jsBare = line.match(/^at ([^:]+):(\d+)(?::(\d+))?/);
    if (jsBare) {
      return {
        function: null,
        file: jsBare[1],
        line: Number(jsBare[2]),
        col: jsBare[3] ? Number(jsBare[3]) : null,
        in_app: null,
        raw: item,
      };
    }
  }
  return null;
}

function coerceInt(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}