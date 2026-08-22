#!/usr/bin/env python3
"""Setup the database with realistic demo data for screenshot capture.

Reads nothing — assumes the dev server is already running on :8000 and
that demo@eduvuce.in is registered. Ingests additional events with
stack traces and release/env, then creates a funnel + retention event.
"""
import json
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:8000/api"
EMAIL = "demo@eduvuce.in"
PASSWORD = "demopassword12345"


def http(method, path, body=None, headers=None):
    h = {"content-type": "application/json"}
    if headers:
        h.update(headers)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode()
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


# Login
code, body = http("POST", "/auth/login", {"email": EMAIL, "password": PASSWORD})
assert code == 200, f"login: {code} {body}"
access = body["access_token"]
auth = {"authorization": f"Bearer {access}"}
print(f"login OK")

# Find org + project
code, orgs = http("GET", "/orgs", headers=auth)
assert code == 200 and orgs, f"orgs: {code} {orgs}"
org_id = orgs[0]["id"]

code, projects = http("GET", f"/orgs/{org_id}/projects", headers=auth)
assert code == 200 and projects, f"projects: {code} {projects}"
project_id = projects[0]["id"]
print(f"project: {project_id}")

# Find an api key for the project
code, keys = http("GET", f"/projects/{project_id}/api-keys", headers=auth)
print(f"keys: {code} count={len(keys) if isinstance(keys, list) else '?'}")
api_key = None
if isinstance(keys, list) and keys:
    # Create a new key to get the secret value
    code, k = http("POST", f"/projects/{project_id}/api-keys", {"name": "screenshot-key"}, headers=auth)
    print(f"create key: {code}")
    if code in (200, 201):
        api_key = k.get("api_key")
if not api_key:
    print("no API key, abort", file=sys.stderr)
    sys.exit(1)

# Ingest realistic events with stack traces + release/environment
events = [
    ("page_view", "u_001", {"path": "/landing", "referrer": "twitter"}),
    ("page_view", "u_002", {"path": "/dashboard"}),
    ("signup_started", "u_001", {"plan": "pro"}),
    ("signup_completed", "u_001", {"plan": "pro", "country": "IN"}),
    ("feature_used", "u_001", {"feature": "funnels"}),
    ("feature_used", "u_002", {"feature": "webhooks"}),
    ("page_view", "u_003", {"path": "/docs"}),
    ("page_view", "u_003", {"path": "/pricing"}),
    ("signup_started", "u_003", {"plan": "free"}),
    ("error", "u_002", {
        "stack": [
            {"function": "render", "filename": "/app/src/app/(app)/dashboard/page.tsx", "lineno": 42, "colno": 7, "in_app": True},
            {"function": "useQuery", "filename": "/app/node_modules/@tanstack/react-query/build/modern/useBaseQuery.js", "lineno": 137, "in_app": False},
            {"function": "DashboardInner", "filename": "/app/src/app/(app)/dashboard/page.tsx", "lineno": 18, "colno": 5, "in_app": True},
        ],
        "error_type": "TypeError",
        "message": "Cannot read properties of undefined (reading 'data')",
    }),
]
for name, user_id, props in events:
    code, body = http(
        "POST",
        "/events",
        {
            "event_name": name,
            "user_id": user_id,
            "timestamp": "2026-08-22T10:30:00+00:00",
            "release": "devobs@1.0.0",
            "environment": "production",
            "properties": props,
        },
        headers={"x-api-key": api_key},
    )
    print(f"ingest {name}: {code}")

# Create a funnel
code, body = http(
    "POST",
    f"/projects/{project_id}/funnels",
    {"name": "Signup funnel", "steps": ["page_view", "signup_started", "signup_completed"]},
    headers=auth,
)
print(f"create funnel: {code} {body if code not in (200, 201) else 'OK'}")

# Snapshot today's funnel so trend has data
if code in (200, 201):
    fid = body["id"]
    code, _ = http("POST", f"/projects/{project_id}/funnels/{fid}/snapshot", {}, headers=auth)
    print(f"snapshot funnel: {code}")

# Create a webhook for the screenshot
code, body = http(
    "POST",
    f"/projects/{project_id}/webhooks",
    {
        "name": "Demo webhook",
        "url": "https://example.com/devobservatory-events",
        "event_filter": "error",
        "active": True,
    },
    headers=auth,
)
print(f"create webhook: {code}")
if code in (200, 201):
    print(f"  secret: {body.get('secret', '?')[:30]}...")

print("DONE")
