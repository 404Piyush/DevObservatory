"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMe } from "@/lib/queries";

export default function SettingsPage() {
  const me = useMe();
  const data = me.data;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Email:</span>{" "}
            <span className="font-medium">{data ? data.email : "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Name:</span>{" "}
            <span className="font-medium">{data ? data.name ?? "—" : "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">User ID:</span>{" "}
            <span className="font-mono text-xs">{data ? data.id : "—"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}