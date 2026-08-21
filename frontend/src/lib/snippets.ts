/**
 * Generate a copy-pasteable ingest snippet for the given API key, in the
 * requested language. Pure client-side — no network calls.
 */

export type SdkLanguage = "curl" | "node" | "python" | "go";

export function ingestSnippet(lang: SdkLanguage, apiKey: string, eventName = "user_signup"): string {
  switch (lang) {
    case "curl":
      return `curl -X POST http://localhost:8000/api/events \\
  -H "X-API-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event_name": "${eventName}",
    "user_id": "user_123",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "properties": {"plan": "pro"}
  }'`;

    case "node":
      return `// using node 18+ global fetch
await fetch("http://localhost:8000/api/events", {
  method: "POST",
  headers: {
    "X-API-Key": "${apiKey}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    event_name: "${eventName}",
    user_id: "user_123",
    timestamp: new Date().toISOString(),
    properties: { plan: "pro" },
  }),
});`;

    case "python":
      return `import httpx, datetime

response = httpx.post(
    "http://localhost:8000/api/events",
    headers={"X-API-Key": "${apiKey}"},
    json={
        "event_name": "${eventName}",
        "user_id": "user_123",
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "properties": {"plan": "pro"},
    },
)
response.raise_for_status()`;

    case "go":
      return `package main

import (
\t"bytes"
\t"encoding/json"
\t"fmt"
\t"net/http"
\t"time"
)

func main() {
\tpayload, _ := json.Marshal(map[string]any{
\t\t"event_name": "${eventName}",
\t\t"user_id":    "user_123",
\t\t"timestamp":  time.Now().UTC().Format(time.RFC3339),
\t\t"properties": map[string]any{"plan": "pro"},
\t})
\treq, _ := http.NewRequest("POST", "http://localhost:8000/api/events", bytes.NewReader(payload))
\treq.Header.Set("X-API-Key", "${apiKey}")
\treq.Header.Set("Content-Type", "application/json")
\tresp, err := http.DefaultClient.Do(req)
\tif err != nil {
\t\tpanic(err)
\t}
\tdefer resp.Body.Close()
\tfmt.Println(resp.Status)
}`;
  }
}