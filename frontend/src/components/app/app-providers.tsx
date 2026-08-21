"use client";

import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { QueryProvider } from "./query-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <TooltipProvider delayDuration={150}>
        {children}
        <Toaster position="top-right" theme="system" richColors />
      </TooltipProvider>
    </QueryProvider>
  );
}