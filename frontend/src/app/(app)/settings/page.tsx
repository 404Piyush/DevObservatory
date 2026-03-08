"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Me = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
};

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json() as Promise<Me>)
      .then((data) => setMe(data))
      .catch(() => setMe(null));
  }, []);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Email:</span>{" "}
            <span className="font-medium">{me ? me.email : "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Name:</span>{" "}
            <span className="font-medium">{me ? me.name ?? "—" : "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">User ID:</span>{" "}
            <span className="font-mono text-xs">{me ? me.id : "—"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
