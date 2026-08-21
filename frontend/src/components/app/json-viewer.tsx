"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type UnknownValue = unknown;

type Props = {
  data: UnknownValue;
  /** Path to display at the root (e.g. "$.properties"). */
  rootLabel?: string;
  /** Initial depth that renders expanded. */
  initialExpandedDepth?: number;
  className?: string;
};

/** Render a JSON value with collapsible nodes, color-coded primitives, and copy-path. */
export function JsonViewer({
  data,
  rootLabel = "$",
  initialExpandedDepth = 2,
  className,
}: Props) {
  return (
    <div className={cn("font-mono text-xs", className)}>
      <Node value={data} label={rootLabel} path={rootLabel} depth={0} initialExpandedDepth={initialExpandedDepth} isRoot />
    </div>
  );
}

function Node({
  value,
  label,
  path,
  depth,
  initialExpandedDepth,
  isRoot = false,
}: {
  value: UnknownValue;
  label: string;
  path: string;
  depth: number;
  initialExpandedDepth: number;
  isRoot?: boolean;
}) {
  const [open, setOpen] = useState(depth < initialExpandedDepth);
  const type = typeOf(value);

  if (type === "object") {
    const entries = Object.entries(value as Record<string, JsonValue>);
    const isEmpty = entries.length === 0;
    return (
      <div className={cn("pl-3", !isRoot && "border-l border-border")}>
        <Row
          label={label}
          path={path}
          type={isEmpty ? "object" : "object"}
          summary={isEmpty ? "{}" : `{${entries.length}}`}
          open={open}
          onToggle={() => setOpen((v) => !v)}
          expandable={!isEmpty}
        />
        {open && !isEmpty ? (
          <div className="ml-2">
            {entries.map(([k, v]) => (
              <Node
                key={k}
                value={v}
                label={k}
                path={`${path}.${k}`}
                depth={depth + 1}
                initialExpandedDepth={initialExpandedDepth}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (type === "array") {
    const arr = value as JsonValue[];
    const isEmpty = arr.length === 0;
    return (
      <div className={cn("pl-3", !isRoot && "border-l border-border")}>
        <Row
          label={label}
          path={path}
          type="array"
          summary={isEmpty ? "[]" : `[${arr.length}]`}
          open={open}
          onToggle={() => setOpen((v) => !v)}
          expandable={!isEmpty}
        />
        {open && !isEmpty ? (
          <div className="ml-2">
            {arr.map((item, i) => (
              <Node
                key={i}
                value={item}
                label={`[${i}]`}
                path={`${path}[${i}]`}
                depth={depth + 1}
                initialExpandedDepth={initialExpandedDepth}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <PrimitiveRow label={label} path={path} value={value} type={type} />
  );
}

function Row({
  label,
  path,
  type,
  summary,
  open,
  onToggle,
  expandable,
}: {
  label: string;
  path: string;
  type: "object" | "array";
  summary: string;
  open: boolean;
  onToggle: () => void;
  expandable: boolean;
}) {
  return (
    <div className="group flex items-center gap-1 py-0.5">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-left"
        aria-expanded={open}
        disabled={!expandable}
      >
        {expandable ? (
          open ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )
        ) : (
          <span className="inline-block h-3 w-3" />
        )}
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground">{summary}</span>
      </button>
      <PathButton path={path} />
    </div>
  );
}

function PrimitiveRow({
  label,
  path,
  value,
  type,
}: {
  label: string;
  path: string;
  value: UnknownValue;
  type: "string" | "number" | "boolean" | "null";
}) {
  return (
    <div className="group flex items-center gap-1 py-0.5 pl-3">
      <span className="text-foreground">{label}:</span>
      <ValueText value={value} type={type} />
      <PathButton path={path} />
      <ValueCopyButton value={value} />
    </div>
  );
}

function ValueText({ value, type }: { value: UnknownValue; type: "string" | "number" | "boolean" | "null" }) {
  if (type === "string") {
    return <span className="text-emerald-600 dark:text-emerald-400">"{String(value)}"</span>;
  }
  if (type === "number") {
    return <span className="text-blue-600 dark:text-blue-400">{String(value)}</span>;
  }
  if (type === "boolean") {
    return <span className="text-amber-600 dark:text-amber-400">{String(value)}</span>;
  }
  return <span className="text-muted-foreground">null</span>;
}

function PathButton({ path }: { path: string }) {
  return (
    <button
      type="button"
      onClick={() => copyToClipboard(path, "Path")}
      className="invisible ml-1 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground group-hover:visible"
      aria-label={`Copy path ${path}`}
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}

function ValueCopyButton({ value }: { value: UnknownValue }) {
  const text = typeOf(value) === "string" ? String(value) : JSON.stringify(value);
  return (
    <button
      type="button"
      onClick={() => copyToClipboard(text, "Value")}
      className="invisible ml-1 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground group-hover:visible"
      aria-label="Copy value"
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}

async function copyToClipboard(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Clipboard unavailable");
  }
}

function typeOf(v: UnknownValue): "object" | "array" | "string" | "number" | "boolean" | "null" {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "object") return "object";
  return typeof v as "string" | "number" | "boolean";
}