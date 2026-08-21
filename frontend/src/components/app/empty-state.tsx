import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Action = {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "outline";
};

type Props = {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: Action[];
  className?: string;
};

/** A centered empty state with title, description, optional icon and actions. */
export function EmptyState({ title, description, icon, actions, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-10 text-center",
        className,
      )}
    >
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <div className="space-y-1">
        <div className="font-medium">{title}</div>
        {description ? (
          <div className="mx-auto max-w-md text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {actions && actions.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {actions.map((a, i) => {
            if (a.href) {
              return (
                <a
                  key={i}
                  href={a.href}
                  className={cn(
                    "inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors",
                    a.variant === "outline"
                      ? "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                      : "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                >
                  {a.label}
                </a>
              );
            }
            return (
              <button
                key={i}
                type="button"
                onClick={a.onClick}
                className={cn(
                  "inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors",
                  a.variant === "outline"
                    ? "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                    : "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}