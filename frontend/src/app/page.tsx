/* eslint-disable react/no-unescaped-entities -- apostrophes and quotes in user-facing copy are intentional */
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Filter, Gauge, Link2, Sparkles, Workflow } from "lucide-react";

const features = [
  {
    icon: Activity,
    title: "Live event stream",
    body: "Send events with a single API key. Watch them appear in real time via Server-Sent Events powered by a Postgres LISTEN/NOTIFY trigger.",
  },
  {
    icon: Gauge,
    title: "Per-project analytics",
    body: "Per-minute time-series and top-events charts for the last 24 hours, with one project selector across every page.",
  },
  {
    icon: Workflow,
    title: "Conversion funnels",
    body: "Define an ordered list of event names. Get step-by-step conversion rates over selectable 1h / 24h / 7d / 30d windows.",
  },
  {
    icon: Filter,
    title: "Search & filters",
    body: "Cursor-paginated event search by name, user_id, and time range. Toggle filters and the chart and list update together.",
  },
  {
    icon: Link2,
    title: "Public share links",
    body: "Mint a 30-day tokenized read-only URL for a project's dashboard. Embed it in a blog post or share it with your team.",
  },
  {
    icon: Sparkles,
    title: "One-click demo",
    body: "Seed a sample org + project + 30 days of synthetic events to explore the dashboards without writing any code.",
  },
];

const archSteps = [
  { label: "Client", sub: "POST /api/events with X-API-Key" },
  { label: "FastAPI", sub: "Validates key, publishes to RabbitMQ" },
  { label: "RabbitMQ", sub: "Durable queue 'events'" },
  { label: "Worker", sub: "aio-pika → INSERT into Postgres" },
  { label: "Postgres", sub: "Trigger fires NOTIFY events_inserted" },
  { label: "SSE", sub: "GET /projects/{id}/events/stream" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="font-semibold">
            DevObservatory
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Create account</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
        <section className="grid items-center gap-10 md:grid-cols-2">
          <div className="space-y-6">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Developer observability, <span className="text-indigo-500">without the bill</span>.
            </h1>
            <p className="text-lg text-muted-foreground">
              Send events with a single API key. Watch them stream into per-project dashboards
              with live charts, conversion funnels, and search. Self-host on Render, Neon, and a
              single Postgres — no SaaS lock-in.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="lg">
                <Link href="/signup">Get started</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </div>
          <Card className="border-indigo-500/20 bg-indigo-500/5">
            <CardHeader>
              <CardTitle className="text-base">How it works</CardTitle>
            </CardHeader>
            <CardContent>
              <ArchitectureDiagram />
            </CardContent>
          </Card>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold">Everything you'd expect from a telemetry tool</h2>
          <p className="mt-1 text-muted-foreground">
            Six opinionated features. No bloat, no upsells, no per-event pricing.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title}>
                <CardHeader>
                  <f.icon className="h-5 w-5 text-indigo-500" />
                  <CardTitle className="text-base">{f.title}</CardTitle>
                  <CardDescription>{f.body}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Tech stack</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="grid gap-1">
                <li>FastAPI + SQLAlchemy 2 + Alembic on Postgres</li>
                <li>Next.js 16 (App Router) + React 19 + Tailwind v4</li>
                <li>TanStack Query, Recharts, Zustand, Sonner</li>
                <li>shadcn/ui-style Radix primitives</li>
                <li>RabbitMQ + aio-pika worker for async ingest</li>
                <li>Postgres LISTEN/NOTIFY for SSE</li>
                <li>Pytest, ruff, GitHub Actions</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Run it locally</CardTitle>
              <CardDescription>Docker Compose brings up everything.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
                <code>{`bash scripts/docker-up.sh

# Open
#   http://localhost:3000   UI
#   http://localhost:8000   API`}</code>
              </pre>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-xs text-muted-foreground">
          <div>DevObservatory</div>
          <div>
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>{" "}
            ·{" "}
            <Link href="/signup" className="hover:text-foreground">
              Create account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ArchitectureDiagram() {
  return (
    <ol className="grid gap-2 text-sm">
      {archSteps.map((s, i) => (
        <li key={s.label} className="flex items-start gap-3">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 font-mono text-xs text-indigo-600 dark:text-indigo-300">
            {i + 1}
          </div>
          <div>
            <div className="font-medium">{s.label}</div>
            <div className="text-xs text-muted-foreground">{s.sub}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}